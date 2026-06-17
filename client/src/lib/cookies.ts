/**
 * MedQueue Centralized Cookie Manager
 * All document.cookie access must go through this file to enforce security,
 * expiry bounds, and healthcare-grade data privacy rules.
 */

export const cookies = {
  /**
   * Retrieves a cookie value by name.
   */
  getCookie(name: string): string | null {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  },

  /**
   * Sets a cookie with standard security parameters.
   * Enforces Lax SameSite, Path=/, and Secure flag when on HTTPS.
   */
  setCookie(name: string, value: string, days?: number): void {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${value || ""}${expires}; path=/; SameSite=Lax${secure}`;
  },

  /**
   * Deletes a cookie by setting its expiration to the past.
   */
  deleteCookie(name: string): void {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax${secure}`;
  },

  /**
   * Verifies if consent exists for a specific cookie category.
   * Healthcare Rule: Essential cookies are always allowed.
   */
  hasConsent(category: 'essential' | 'preferences' | 'analytics'): boolean {
    if (category === 'essential') return true;

    const consent = this.getCookie('medqueue_cookie_consent');
    if (!consent) return false;
    if (consent === 'accepted') return true;
    if (consent === 'rejected') return false;

    // customized consent scenario
    if (category === 'preferences') {
      return this.getCookie('medqueue_preferences_consent') === 'true';
    }
    if (category === 'analytics') {
      return this.getCookie('medqueue_analytics_consent') === 'true';
    }
    return false;
  },

  /**
   * Saves custom user consent preferences and cleans up revoked cookies.
   */
  savePreferences(prefs: { preferences: boolean; analytics: boolean }): void {
    this.setCookie('medqueue_cookie_consent', 'customized', 365);
    this.setCookie('medqueue_preferences_consent', prefs.preferences ? 'true' : 'false', 365);
    this.setCookie('medqueue_analytics_consent', prefs.analytics ? 'true' : 'false', 365);

    // If preferences consent was revoked, delete all associated preference cookies
    if (!prefs.preferences) {
      this.deleteCookie('medqueue_theme');
      this.deleteCookie('medqueue_language');
      this.deleteCookie('medqueue_notifications');
    }

    // If analytics consent was revoked, clean up analytics consent cookie
    if (!prefs.analytics) {
      this.deleteCookie('medqueue_analytics_consent');
      this.setCookie('medqueue_analytics_consent', 'false', 365);
    }
  },

  /**
   * Loads the current active preferences consent state.
   */
  loadPreferences(): { preferences: boolean; analytics: boolean } {
    const consent = this.getCookie('medqueue_cookie_consent');
    if (consent === 'accepted') {
      return { preferences: true, analytics: true };
    }
    if (consent === 'rejected') {
      return { preferences: false, analytics: false };
    }
    return {
      preferences: this.getCookie('medqueue_preferences_consent') === 'true',
      analytics: this.getCookie('medqueue_analytics_consent') === 'true'
    };
  }
};
