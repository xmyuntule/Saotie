import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SiteService } from '../site/site.service';
import * as net from 'node:net';
import * as tls from 'node:tls';

type MailSocket = net.Socket | tls.TLSSocket;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly site: SiteService) {}

  async configured() {
    if ((await this.site.getConfig('smtp_enabled', '0')) !== '1') return false;
    const host = String(await this.site.getConfig('smtp_host', '') || '').trim();
    const user = String(await this.site.getConfig('smtp_user', '') || '').trim();
    const password = String(await this.site.getConfig('smtp_password', '') || '');
    const from = String(await this.site.getConfig('smtp_from', '') || user).trim();
    return !!(host && user && password && from);
  }

  async send(to: string, subject: string, text: string) {
    if (!(await this.configured())) throw new BadRequestException('邮件服务尚未配置，请联系管理员');
    const host = String(await this.site.getConfig('smtp_host', '') || '').trim();
    const port = Math.max(1, Math.min(65535, Number(await this.site.getConfig('smtp_port', '465')) || 465));
    const secure = (await this.site.getConfig('smtp_secure', '1')) === '1';
    const user = String(await this.site.getConfig('smtp_user', '') || '').trim();
    const password = String(await this.site.getConfig('smtp_password', '') || '');
    const from = String(await this.site.getConfig('smtp_from', '') || user).trim();
    const fromName = String(await this.site.getConfig('smtp_from_name', 'Saotie') || 'Saotie').trim();
    const socket = await this.connect(host, port, secure);
    try {
      const greeting = await this.readResponse(socket);
      if (Number(greeting.slice(0, 3)) !== 220) throw new Error(`SMTP ${greeting}`);
      await this.command(socket, 'EHLO saotie.com', 250);
      if (!secure) {
        await this.command(socket, 'STARTTLS', 220);
        const upgraded = await this.startTls(socket, host);
        await this.command(upgraded, 'EHLO saotie.com', 250);
        await this.auth(upgraded, user, password);
        await this.sendMessage(upgraded, from, to, fromName, subject, text);
        await this.command(upgraded, 'QUIT', 221).catch(() => undefined);
        upgraded.end();
      } else {
        await this.auth(socket, user, password);
        await this.sendMessage(socket, from, to, fromName, subject, text);
        await this.command(socket, 'QUIT', 221).catch(() => undefined);
        socket.end();
      }
    } catch (e: any) {
      socket.destroy();
      this.logger.warn(`SMTP 发信失败: ${e?.message || e}`);
      throw new BadRequestException('邮件发送失败，请检查后台 SMTP 配置');
    }
  }

  private connect(host: string, port: number, secure: boolean): Promise<MailSocket> {
    return new Promise((resolve, reject) => {
      const socket = secure
        ? tls.connect({ host, port, servername: host, rejectUnauthorized: true })
        : net.createConnection({ host, port });
      const fail = (e: Error) => { socket.destroy(); reject(e); };
      socket.once('error', fail);
      if (secure) socket.once('secureConnect', () => { socket.removeListener('error', fail); resolve(socket); });
      else socket.once('connect', () => { socket.removeListener('error', fail); resolve(socket); });
    });
  }

  private readResponse(socket: MailSocket): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      const onData = (chunk: Buffer) => {
        data += chunk.toString('utf8');
        const lines = data.split(/\r?\n/);
        for (const line of lines) {
          if (/^\d{3} /.test(line)) {
            cleanup(); resolve(line);
            return;
          }
        }
      };
      const onError = (e: Error) => { cleanup(); reject(e); };
      const cleanup = () => { socket.off('data', onData); socket.off('error', onError); };
      socket.on('data', onData); socket.once('error', onError);
    });
  }

  private async command(socket: MailSocket, command: string, expected: number) {
    socket.write(`${command}\r\n`);
    const response = await this.readResponse(socket);
    if (Number(response.slice(0, 3)) !== expected) throw new Error(`SMTP ${response}`);
  }

  private async auth(socket: MailSocket, user: string, password: string) {
    await this.command(socket, `AUTH PLAIN ${Buffer.from(`\0${user}\0${password}`).toString('base64')}`, 235);
  }

  private async sendMessage(socket: MailSocket, from: string, to: string, fromName: string, subject: string, text: string) {
    await this.command(socket, `MAIL FROM:<${from}>`, 250);
    await this.command(socket, `RCPT TO:<${to}>`, 250);
    socket.write('DATA\r\n');
    const response = await this.readResponse(socket);
    if (Number(response.slice(0, 3)) !== 354) throw new Error(`SMTP ${response}`);
    const safeBody = text.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const encodedName = `=?UTF-8?B?${Buffer.from(fromName).toString('base64')}?=`;
    socket.write(`From: ${encodedName} <${from}>\r\nTo: <${to}>\r\nSubject: ${encodedSubject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${safeBody}\r\n.\r\n`);
    const sent = await this.readResponse(socket);
    if (Number(sent.slice(0, 3)) !== 250) throw new Error(`SMTP ${sent}`);
  }

  private startTls(socket: MailSocket, host: string): Promise<tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const secure = tls.connect({ socket, servername: host, rejectUnauthorized: true }, () => resolve(secure));
      secure.once('error', reject);
    });
  }

  async test() {
    if (!(await this.configured())) throw new BadRequestException('请先完整填写 SMTP 主机、账号、密码和发件地址');
    return true;
  }
}
