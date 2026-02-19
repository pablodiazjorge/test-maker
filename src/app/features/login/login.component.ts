import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ProtectedDataResponse } from '../../core/data/protected-data';
import { I18nService } from '../../core/services/i18n.service';
import { QuizService } from '../../core/services/quiz.service';
import { injectAuthStore } from '../../core/state/auth.store';
import { LanguageToggleButtonComponent } from '../../shared/components/language-toggle-button/language-toggle-button.component';
import { ThemeToggleButtonComponent } from '../../shared/components/theme-toggle-button/theme-toggle-button.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ThemeToggleButtonComponent, LanguageToggleButtonComponent, TranslateModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly authStore = injectAuthStore();

  readonly username = signal('');
  readonly password = signal('');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    const existingSession = this.authStore.session();
    if (!existingSession?.userId) {
      return;
    }

    if (this.quizService.isDataLoaded() || this.quizService.restoreMasterDataFromCache(existingSession.userId)) {
      void this.router.navigate(['/config']);
      return;
    }

    this.authStore.logout();
    this.quizService.clearMasterData({ userId: existingSession.userId });
  }

  onUsernameInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.username.set(input?.value ?? '');
  }

  onPasswordInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.password.set(input?.value ?? '');
  }

  useGuestCredentials(): void {
    this.username.set('invitado');
    this.password.set('invcont123');
    this.errorMessage.set(null);
  }

  async login(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    const trimmedUsername = this.username().trim();
    const trimmedPassword = this.password().trim();
    if (!trimmedUsername) {
      this.errorMessage.set(this.i18n.t('errors.username_required'));
      return;
    }

    if (!trimmedPassword) {
      this.errorMessage.set(this.i18n.t('errors.password_required'));
      return;
    }

    this.isSubmitting.set(true);

    try {
      const response = await firstValueFrom(
        this.http.post<ProtectedDataResponse>('/api/get-data', {
          username: trimmedUsername,
          password: trimmedPassword,
        }),
      );

      const loaded = this.quizService.setMasterData(response.data, response.userId);
      if (!loaded) {
        this.errorMessage.set(this.i18n.t('errors.could_not_load_question_bank'));
        return;
      }

      this.authStore.login(response.userId);
      this.username.set('');
      this.password.set('');
      await this.router.navigate(['/config']);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.errorMessage.set(this.i18n.t('errors.invalid_credentials'));
      } else {
        this.errorMessage.set(this.i18n.t('errors.unable_to_decrypt_data'));
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
