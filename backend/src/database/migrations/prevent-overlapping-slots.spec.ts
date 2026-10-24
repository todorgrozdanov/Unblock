import type { QueryRunner } from 'typeorm';
import { PreventOverlappingSlots1792890000000 } from './1792890000000-PreventOverlappingSlots.js';

describe('Overlap migration preflight (no database)', () => {
  it('locks and checks existing slots before adding the exclusion constraint', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ overlaps: false }])
      .mockResolvedValueOnce([]);
    await new PreventOverlappingSlots1792890000000().up({ query } as unknown as QueryRunner);
    expect(query.mock.calls[0][0]).toContain('LOCK TABLE');
    expect(query.mock.calls[1][0]).toContain('SELECT EXISTS');
    expect(query.mock.calls[2][0]).toContain('ADD CONSTRAINT "EX_slots_no_overlap"');
    expect(query.mock.calls[2][0]).toContain('WITH &&');
    expect(query.mock.calls[2][0]).toContain("'[)'");
  });

  it('stops without changing existing slots when overlaps are found', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ overlaps: true }]);
    await expect(new PreventOverlappingSlots1792890000000().up({ query } as unknown as QueryRunner))
      .rejects.toThrow('Existing slots overlap');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.every(([sql]) => !/DELETE|UPDATE|ALTER|DROP/.test(sql))).toBe(true);
  });
});
