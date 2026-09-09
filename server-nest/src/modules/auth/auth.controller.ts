import { Body, Controller, Get, Ip, Post, Put, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ChangeUsernameDto,
  LoginDto,
  RegisterDto,
  EmailCodeDto,
  ResetPasswordDto,
} from './dto/auth.dto';

/**
 * /api/auth — register, login, me, password, checkin, change-username.
 * Endpoint paths and JSON shapes match server/src/routes/auth.js exactly.
 */
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('register-policy')
  registerPolicy() {
    return this.auth.registerPolicy();
  }

  @Get('register-captcha')
  registerCaptcha(@Ip() ip: string) {
    return this.auth.createRegisterCaptcha(ip);
  }

  @Get('login-captcha')
  loginCaptcha(@Ip() ip: string) {
    return this.auth.createLoginCaptcha(ip);
  }

  @Post('register')
  register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.auth.register(dto, ip);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: EmailCodeDto, @Ip() ip: string) {
    return this.auth.forgotPassword(dto, ip);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.auth.me(user);
  }

  @Post('password')
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, dto);
  }

  @Get('email-status')
  @UseGuards(JwtAuthGuard)
  emailStatus(@CurrentUser() user: User) {
    return this.auth.emailStatus(user);
  }

  @Post('email-code')
  @UseGuards(JwtAuthGuard)
  emailCode(@CurrentUser() user: User, @Body() dto: EmailCodeDto) {
    return this.auth.sendEmailCode(user, dto);
  }

  @Put('email')
  @UseGuards(JwtAuthGuard)
  bindEmail(@CurrentUser() user: User, @Body() dto: EmailCodeDto) {
    return this.auth.bindEmail(user, dto);
  }

  @Post('checkin')
  @UseGuards(JwtAuthGuard)
  checkin(@CurrentUser() user: User) {
    return this.auth.checkin(user);
  }

  @Post('change-username')
  @UseGuards(JwtAuthGuard)
  changeUsername(@CurrentUser() user: User, @Body() dto: ChangeUsernameDto) {
    return this.auth.changeUsername(user, dto);
  }
}
