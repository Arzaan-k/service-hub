/**
 * Simple test utilities for travel planning tests
 * This is a minimal test framework replacement
 */

export interface TestContext {
  name: string;
  fn: () => Promise<void> | void;
}

const tests: TestContext[] = [];
let currentDescribe = '';

export function describe(name: string, fn: () => void) {
  currentDescribe = name;
  fn();
  currentDescribe = '';
}

export function it(name: string, fn: () => Promise<void> | void) {
  tests.push({
    name: `${currentDescribe} - ${name}`,
    fn,
  });
}

export async function beforeAll(fn: () => Promise<void> | void) {
  await fn();
}

export async function afterAll(fn: () => Promise<void> | void) {
  await fn();
}

export const expect = {
  toBe: (actual: any, expected: any) => {
    if (actual !== expected) {
      throw new Error(`Expected ${actual} to be ${expected}`);
    }
  },
  toBeDefined: (actual: any) => {
    if (actual === undefined || actual === null) {
      throw new Error(`Expected value to be defined, got ${actual}`);
    }
  },
  toBeUndefined: (actual: any) => {
    if (actual !== undefined) {
      throw new Error(`Expected value to be undefined, got ${actual}`);
    }
  },
  rejects: {
    toThrow: async (promise: Promise<any>) => {
      try {
        await promise;
        throw new Error('Expected promise to reject');
      } catch (error) {
        // Expected rejection
      }
    },
  },
};

