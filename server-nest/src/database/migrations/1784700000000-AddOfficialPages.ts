import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
} from 'typeorm';

export class AddOfficialPages1784700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'official_pages',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'slug', type: 'varchar', length: '64' },
          { name: 'title', type: 'varchar', length: '120' },
          { name: 'seo_title', type: 'varchar', length: '160', default: "''" },
          { name: 'seo_keywords', type: 'varchar', length: '255', default: "''" },
          { name: 'seo_description', type: 'varchar', length: '255', default: "''" },
          { name: 'cover', type: 'text', isNullable: true },
          { name: 'content', type: 'text', isNullable: true },
          { name: 'status', type: 'smallint', default: '1' },
          { name: 'sort', type: 'int', default: '0' },
          { name: 'created_at', type: 'varchar', length: '32' },
          { name: 'updated_at', type: 'varchar', length: '32' },
        ],
      }),
    );

    await queryRunner.createIndices('official_pages', [
      new TableIndex({
        name: 'uq_official_pages_slug',
        columnNames: ['slug'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'idx_official_pages_status_sort',
        columnNames: ['status', 'sort'],
      }),
    ]);

    const now = new Date().toISOString();
    await queryRunner.manager
      .createQueryBuilder()
      .insert()
      .into('official_pages')
      .values([
        {
          slug: 'home',
          title: 'SaotieSNS',
          seo_title: 'SaotieSNS · 轻社交社区',
          seo_keywords: 'SaotieSNS,社区,论坛,轻社交',
          seo_description: '连接有趣的人与值得分享的内容，体验 SaotieSNS 轻社交社区。',
          content: '# 连接有趣的人\n与值得分享的内容\n\nSaotieSNS 是一个轻社交、轻论坛、轻社区系统，支持动态、论坛、圈子、问答、文章、活动与积分玩法。\n\n欢迎进入社区，发现有趣的内容，也欢迎通过开源仓库参与二次开发。',
          status: 1,
          sort: 0,
          created_at: now,
          updated_at: now,
        },
        {
          slug: 'about',
          title: '关于 SaotieSNS',
          seo_title: '关于 SaotieSNS',
          seo_keywords: 'SaotieSNS,关于,开源社区',
          seo_description: '了解 SaotieSNS 的定位、功能和开源理念。',
          content: '# 关于 SaotieSNS\n\nSaotieSNS 面向轻社交、轻论坛与兴趣社区场景，强调内容交流、社区互动和可持续运营。\n\n## 社区功能\n\n- 动态：文字、图片、视频、话题、评论与互动\n- 论坛：板块讨论、版主管理、置顶与精华\n- 圈子：创建兴趣社群，沉淀圈内内容\n- 问答：提问、回答、悬赏与积分激励\n- 运营：签到、任务、抽奖、积分商城与会员中心\n\n## 开源与二次开发\n\n项目代码发布在 GitHub，支持自托管和二次开发。官网内容、玩法说明和社区动态会持续更新。',
          status: 1,
          sort: 10,
          created_at: now,
          updated_at: now,
        },
        {
          slug: 'guide',
          title: '社区玩法',
          seo_title: 'SaotieSNS 社区玩法',
          seo_keywords: 'SaotieSNS,社区玩法,积分,签到,任务',
          seo_description: '了解 SaotieSNS 的签到、任务、积分和社区互动玩法。',
          content: '# 社区玩法\n\n## 每日签到\n\n每天打开社区完成签到，可以获得积分和连续签到奖励。\n\n## 任务与积分\n\n参与投票、发布内容、互动评论等行为可以完成任务，积分可用于打赏、兑换商城商品和参与活动。\n\n## 内容交流\n\n你可以发布动态、加入圈子、参与论坛讨论，也可以通过问答板块帮助其他用户解决问题。',
          status: 1,
          sort: 20,
          created_at: now,
          updated_at: now,
        },
      ])
      .execute();
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('official_pages', true);
  }
}
