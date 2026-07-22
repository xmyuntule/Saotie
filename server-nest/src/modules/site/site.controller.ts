import { Controller, Get, Param } from '@nestjs/common';
import { SiteService } from './site.service';

/** /api/site — 公开只读站点配置（品牌 + 自定义 CSS + 模块开关）。Mirrors server/src/routes/site.js. */
@Controller('api/site')
export class SiteController {
  constructor(private readonly site: SiteService) {}

  @Get()
  get() {
    return this.site.getSite();
  }

  @Get('official/pages')
  officialPages() {
    return this.site.getOfficialPages();
  }

  @Get('official/pages/:slug')
  officialPage(@Param('slug') slug: string) {
    return this.site.getOfficialBundle(slug);
  }

  @Get('official/widgets')
  officialWidgets() {
    return this.site.getOfficialWidgets();
  }
}
