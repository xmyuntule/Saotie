import { Controller, Get } from '@nestjs/common';
import { SiteService } from './site.service';

/** /api/site — 公开只读站点配置（品牌 + 自定义 CSS + 模块开关）。Mirrors server/src/routes/site.js. */
@Controller('api/site')
export class SiteController {
  constructor(private readonly site: SiteService) {}

  @Get()
  get() {
    return this.site.getSite();
  }
}
