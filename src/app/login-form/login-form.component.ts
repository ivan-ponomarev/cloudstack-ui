import { Component, Inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../shared';
import { INotificationService } from '../shared/notification.service';

@Component({
  selector: 'cs-login-form',
  templateUrl: './login-form.component.html',
  styleUrls: ['./login-form.scss'],
})
export class LoginFormComponent {

  private username: string;
  private password: string;
  private usernameRequired: boolean;
  private passwordRequired: boolean;

  constructor(
    private auth: AuthService,
    @Inject('INotificationService') private notification: INotificationService,
    private router: Router
  ) {
    this.username = '';
    this.password = '';
    this.usernameRequired = false;
    this.passwordRequired = false;
  }

  private onSubmit(): void {
    this.login(this.username, this.password);
  }

  private login(username: string, password: string): void {
    this.auth.login(username, password)
      .then(() => this.handleLogin())
      .catch(error => this.handleError(error));
  }

  private handleLogin(): void {
    this.router.navigate(['/client']);
  }

  private handleError(error: string): void {
    this.usernameRequired = !this.username;
    this.passwordRequired = !this.password;
    let t = !this.usernameRequired && !this.passwordRequired;
    if (!this.usernameRequired && !this.passwordRequired) {
      this.notification.message(error);
    }
  }
}
