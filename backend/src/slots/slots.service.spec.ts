import { DataSource } from 'typeorm';
import { Slot } from '../database/entities/slot.entity.js';
import { Booking } from '../database/entities/booking.entity.js';
import { SlotsService } from './slots.service.js';

// Build real PostgreSQL SQL/metadata without opening any database connection.
class MetadataDataSource extends DataSource {
  async prepareMetadata() { await this.buildMetadatas(); }
}

describe('SlotsService availability query (no database)', () => {
  it('filters future unbooked slots, sorts ascending, and selects only slot fields', async () => {
    const database = new MetadataDataSource({
      type: 'postgres', entities: [Slot, Booking],
    });
    await database.prepareMetadata();
    const repository = database.getRepository(Slot);
    const query = repository.createQueryBuilder('slot');
    const available = [{ id: 'available-slot' }];
    vi.spyOn(repository, 'createQueryBuilder').mockReturnValue(query);
    vi.spyOn(query, 'getMany').mockResolvedValue(available as Slot[]);

    expect(await new SlotsService(repository).findAvailable()).toBe(available);
    const sql = query.getSql();
    expect(sql).toContain('"slot"."startsAt" > $1');
    expect(sql).toContain('NOT EXISTS (SELECT 1 FROM "bookings" "booking"');
    expect(sql).toContain('"booking"."slotId" = "slot"."id"');
    expect(query.expressionMap.orderBys).toEqual({ 'slot.startsAt': 'ASC' });
    expect(sql).not.toContain('"email"');
    expect(sql).not.toContain('"name"');
    expect(query.getParameters().now).toBeInstanceOf(Date);
  });
});
