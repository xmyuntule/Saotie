import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SeoPage, SeoService } from './seo.service';

@Controller()
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('robots.txt')
  robots(@Res() res: Response) {
    res.type('text/plain').setHeader('Cache-Control', 'public, max-age=3600');
    res.send(this.seo.robotsTxt());
  }

  @Get('sitemap.xml')
  async sitemap(@Res() res: Response) {
    res.type('application/xml').setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600');
    res.send(await this.seo.sitemapXml());
  }

  @Get(['discover', 'forum', 'flash', 'circles', 'qa', 'articles'])
  staticPage(@Param() _param: any, @Req() req: Request, @Res() res: Response) {
    return this.render(req, res, () => this.seo.staticPage(req.path));
  }

  @Get('post/:id')
  post(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    return this.render(req, res, () => this.seo.post(Number(id)));
  }

  @Get('article/:id')
  article(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    return this.render(req, res, () => this.seo.article(Number(id)));
  }

  @Get('thread/:id')
  thread(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    return this.render(req, res, () => this.seo.thread(Number(id)));
  }

  @Get('qa/:id')
  question(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    return this.render(req, res, () => this.seo.question(Number(id)));
  }

  @Get('circle/:slug')
  circle(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response) {
    return this.render(req, res, () => this.seo.circle(slug));
  }

  @Get('forum/:slug')
  board(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response) {
    return this.render(req, res, () => this.seo.board(slug));
  }

  @Get('topic/:name')
  topic(@Param('name') name: string, @Req() req: Request, @Res() res: Response) {
    return this.render(req, res, () => this.seo.topic(name));
  }

  @Get('u/:username')
  profile(@Param('username') username: string, @Req() req: Request, @Res() res: Response) {
    return this.render(req, res, () => this.seo.profile(username));
  }

  private async render(req: Request, res: Response, build: () => Promise<SeoPage | null> | SeoPage | null) {
    if (!this.seo.shouldServeSeo(req)) return this.seo.sendSpa(res);
    const page = await build();
    if (!page) return this.seo.sendNotFound(res, req.path);
    res.type('text/html').setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.send(this.seo.renderPage(page));
  }
}
