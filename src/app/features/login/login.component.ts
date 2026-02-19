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

  readonly password = signal('');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    if (this.authStore.isAuthenticated() && this.quizService.isDataLoaded()) {
      void this.router.navigate(['/config']);
      return;
    }

    if (this.authStore.isAuthenticated() && !this.quizService.isDataLoaded()) {
      this.authStore.logout();
      this.quizService.clearMasterData();
    }
  }

  onPasswordInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.password.set(input?.value ?? '');
  }

  async login(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    const trimmedPassword = this.password().trim();
    if (!trimmedPassword) {
      this.errorMessage.set('La contrasena es obligatoria.');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const response = await firstValueFrom(
        this.http.post<ProtectedDataResponse>('/api/get-data', {
          password: trimmedPassword,
        }),
      );

      const loaded = this.quizService.setMasterData(response.data);
      if (!loaded) {
        this.errorMessage.set('No se pudo cargar el banco de preguntas.');
        return;
      }

      this.authStore.login();
      this.password.set('');
      await this.router.navigate(['/config']);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.errorMessage.set('Contrasena incorrecta.');
      } else {
        this.errorMessage.set('No fue posible descifrar los datos. Intenta de nuevo.');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
