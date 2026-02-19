import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProtectedDataResponse } from '../../core/data/protected-data';
import { QuizService } from '../../core/services/quiz.service';
import { injectAuthStore } from '../../core/state/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly http = inject(HttpClient);
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

  async login(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    const trimmedUsername = this.username().trim();
    const trimmedPassword = this.password().trim();
    if (!trimmedUsername) {
      this.errorMessage.set('El usuario es obligatorio.');
      return;
    }

    if (!trimmedPassword) {
      this.errorMessage.set('La contrasena es obligatoria.');
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
        this.errorMessage.set('No se pudo cargar el banco de preguntas.');
        return;
      }

      this.authStore.login(response.userId);
      this.username.set('');
      this.password.set('');
      await this.router.navigate(['/config']);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.errorMessage.set('Credenciales invalidas.');
      } else if (error instanceof HttpErrorResponse) {
        const backendMessage =
          typeof error.error?.error === 'string'
            ? error.error.error
            : typeof error.error?.message === 'string'
              ? error.error.message
              : null;
        this.errorMessage.set(backendMessage ?? 'No fue posible descifrar los datos. Intenta de nuevo.');
      } else {
        this.errorMessage.set('No fue posible descifrar los datos. Intenta de nuevo.');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
