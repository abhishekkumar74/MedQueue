/* eslint-disable no-undef */
declare const describe: any;
declare const it: any;
declare const expect: any;

import { DEPARTMENTS, DEPARTMENT_LABEL } from '../constants';

/**
 * MedQueue Architecture Standards Test Suite
 * Asserts critical codebase configurations remain fully decoupled and constant types match.
 */
describe('MedQueue Constants Architecture Tests', () => {
  it('should verify all core clinical specialties are mapped to labels', () => {
    DEPARTMENTS.forEach((dept) => {
      expect(DEPARTMENT_LABEL[dept]).toBeDefined();
      expect(typeof DEPARTMENT_LABEL[dept]).toBe('string');
    });
  });

  it('should guarantee general medicine department exists in routing configs', () => {
    expect(DEPARTMENTS).toContain('general');
    expect(DEPARTMENT_LABEL.general).toBe('General Medicine');
  });

  it('should verify total supported clinical nodes is exactly 10', () => {
    expect(DEPARTMENTS.length).toBe(10);
  });
});
