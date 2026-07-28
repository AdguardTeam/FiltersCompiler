import { describe, it, expect } from 'vitest';
// Import from an existing .js module to verify TS→JS imports work
import { RuleMasks } from '../src/main/rule/rule-masks.js';

describe('TypeScript imports JavaScript', () => {
    it('can import a JS module from TS', () => {
        // This test verifies TS→JS imports work via the ambient declarations
        // in src/types/global.d.ts. As JS modules are migrated to TS, this
        // transitional shim approach will no longer be needed.
        expect(RuleMasks.MASK_ELEMENT_HIDING).toBe('##');
    });
});
