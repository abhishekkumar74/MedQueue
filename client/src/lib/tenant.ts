import { supabase } from './supabase';

export interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  theme_color?: string;
  logo_url?: string;
  subscription_status?: string;
  subscription_tier?: string;
}

// Fallback theme colors mapped by slug for rich enterprise branding
const BRANDING_FALLBACKS: Record<string, { theme_color: string; logo_url?: string }> = {
  apollo: {
    theme_color: '#005EB8', // Apollo Blue
    logo_url: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&q=80&w=100'
  },
  max: {
    theme_color: '#00A3AD', // Max Teal
    logo_url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=100'
  },
  city: {
    theme_color: '#6366F1', // City Indigo/Violet
    logo_url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=100'
  }
};

/**
 * Parses the current environment to resolve the tenant workspace slug.
 * Prioritizes:
 * 1. Subdomain routing (e.g., apollo.medqueue.com)
 * 2. URL Query parameters (e.g., ?hosp=apollo or ?h=apollo)
 * 3. Path segments (e.g., /h/apollo)
 */
export function getTenantSlug(): string | null {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  // 1. Exclude localhost, 127.0.0.1, www, and naked domains for subdomain resolution
  if (
    parts.length > 1 && 
    parts[0] !== 'www' && 
    parts[0] !== 'localhost' && 
    parts[0] !== '127' &&
    parts[0] !== '192'
  ) {
    return parts[0];
  }

  // 2. Query parameters (Highly robust developer fallback)
  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get('hosp') || params.get('h');
  if (querySlug) {
    return querySlug.toLowerCase().trim();
  }

  // 3. Path segments (e.g., /h/apollo or /hosp/apollo)
  const pathParts = window.location.pathname.split('/');
  const hIndex = pathParts.indexOf('h');
  if (hIndex !== -1 && pathParts[hIndex + 1]) {
    return pathParts[hIndex + 1].toLowerCase().trim();
  }
  
  const hospIndex = pathParts.indexOf('hosp');
  if (hospIndex !== -1 && pathParts[hospIndex + 1]) {
    return pathParts[hospIndex + 1].toLowerCase().trim();
  }

  // Fallback to localStorage matched context if user is logged in
  try {
    const cachedUserJson = localStorage.getItem('mq_auth_user');
    if (cachedUserJson) {
      const user = JSON.parse(cachedUserJson);
      if (user && user.hospital_id) {
        // Return active fallback slug to resolve tenant locally
        if (user.hospital_id === 'd290f1ee-6c54-4b01-90e6-d701748f0851') return 'apollo';
        if (user.hospital_id === 'a4220b22-83b3-4f9e-a89e-cb01748ff002') return 'max';
        if (user.hospital_id === '7e90a5fe-4b01-90c6-ff22-a701748f0222') return 'city';
      }
    }
  } catch (e) {
    console.warn('Failed to parse cached user for tenant slug fallback', e);
  }

  return null;
}

/**
 * Queries the database for the resolved tenant slug, augmenting with fallback branding tokens.
 */
export async function resolveTenantConfig(slug: string): Promise<TenantConfig | null> {
  try {
    const cleanSlug = slug.toLowerCase().trim();
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (error || !data) {
      // If db fetch failed but is a known slug, provide basic static fallback to prevent broken UI
      const staticBranding = BRANDING_FALLBACKS[cleanSlug];
      if (staticBranding) {
        return {
          id: cleanSlug === 'apollo' ? 'd290f1ee-6c54-4b01-90e6-d701748f0851' :
              cleanSlug === 'max' ? 'a4220b22-83b3-4f9e-a89e-cb01748ff002' :
              '7e90a5fe-4b01-90c6-ff22-a701748f0222',
          name: cleanSlug === 'apollo' ? 'Apollo Clinic' :
                cleanSlug === 'max' ? 'Max Health' : 'City Hospital',
          slug: cleanSlug,
          ...staticBranding
        };
      }
      return null;
    }

    // Mix in fallbacks or custom column values if they exist on the table
    const branding = BRANDING_FALLBACKS[cleanSlug] || { theme_color: '#005EB8' };
    return {
      ...data,
      theme_color: data.theme_color || branding.theme_color,
      logo_url: data.logo_url || branding.logo_url
    };
  } catch (err) {
    console.error('Failed to resolve tenant config:', err);
    return null;
  }
}
