// ─── Interfaces de Autenticación y Formularios ─────────────────────────────

/** Estado del formulario de inicio de sesión */
export interface LoginFormState {
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
}

/** Estado del formulario de registro de cuenta */
export interface RegisterFormState {
  fullName: string;
  idNumber: string;
  email: string;
  password: string;
  phoneNumber: string;
  showPassword: boolean;
  loading: boolean;
  /** Indica si el correo de verificación ya fue enviado exitosamente */
  verificationSent: boolean;
  /** Email al que se envió la verificación (para mostrarlo en pantalla) */
  registeredEmail: string;
}

/** Estado del formulario de recuperación de contraseña */
export interface ForgotPasswordFormState {
  email: string;
  loading: boolean;
  /** Indica si el enlace de recuperación ya fue enviado */
  emailSent: boolean;
  /** Email al que se envió el enlace (para mostrarlo en pantalla) */
  sentEmail: string;
}

/** DTO para el registro de usuarios en Firebase mediante el backend */
export interface FirebaseEmailRegisterDto {
  email: string;
  password: string;
  registrationRole: 'passenger' | 'driver' | 'transport_owner';
  displayName?: string;
  phoneNumber?: string;
  nationalId?: string;
}

/** DTO de respuesta con credenciales emitidas por Firebase */
export interface FirebaseIssuedCredentialsDto {
  idToken: string;
  refreshToken: string;
  expiresIn?: string;
  localId?: string;
}
