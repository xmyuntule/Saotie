import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { SearchService } from './search.service';

/**
 * /api/search — global search + trending keywords.
 * Mirrors server/src/routes/search.js.
 */
@Controller('api/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('trending')
  trending() {
    return this.search.trending();
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  query(@Query('q') q: string, @CurrentUser() user: User | null) {
    return this.search.search(q, user);
  }
}
