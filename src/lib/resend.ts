import { auth } from './firebase';

const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY;
const RESEND_FROM_EMAIL =
  process.env.EXPO_PUBLIC_RESEND_FROM_EMAIL || 'GoFare <onboarding@resend.dev>';

/**
 * Plantilla HTML para recuperación de contraseña vía Resend.
 */
function buildPasswordResetHtml(resetLink: string, userEmail: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recupera tu contraseña - GoFare</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1F2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F3F4F6; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" maxWidth="560" cellspacing="0" cellpadding="0" style="background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); max-width: 560px;">
          
          <tr>
            <td style="background-color: #0047FF; padding: 28px 30px; text-align: center;">
              <h1 style="color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 800;">GoFare</h1>
              <p style="color: #E0E7FF; margin: 4px 0 0 0; font-size: 14px;">Tu servicio de transporte seguro</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="color: #111827; margin-top: 0; margin-bottom: 16px; font-size: 22px; font-weight: 700; text-align: center;">
                Recuperación de Contraseña
              </h2>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
                Hola,
              </p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 24px;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta de GoFare registrada con el correo: 
                <strong style="color: #0047FF;">${userEmail}</strong>.
              </p>

              <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 28px;">
                Para elegir una nueva contraseña de forma rápida y segura, por favor presiona el siguiente botón azul:
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" target="_blank" style="background-color: #0047FF; color: #FFFFFF; text-decoration: none; font-size: 18px; font-weight: bold; padding: 16px 32px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 6px rgba(0, 71, 255, 0.25);">
                      Crear Nueva Contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background-color: #EFF6FF; border-left: 4px solid #0047FF; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #1E40AF;">
                  <strong>🛡️ Tu cuenta está protegida:</strong> Si tú no solicitaste este cambio, no te preocupes. Puedes ignorar este correo con tranquilidad. Tu saldo y tu cuenta siguen totalmente seguros.
                </p>
              </div>

              <p style="font-size: 13px; color: #6B7280; line-height: 1.5; margin-top: 24px; text-align: center;">
                Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br>
                <a href="${resetLink}" style="color: #0047FF; word-break: break-all;">${resetLink}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #F9FAFB; padding: 20px 28px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0; font-size: 13px; color: #9CA3AF;">
                GoFare — Transporte Inteligente y Accesible
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Plantilla HTML para confirmación/verificación de correo electrónico vía Resend.
 */
function buildVerificationEmailHtml(
  verificationLink: string,
  userEmail: string,
): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirma tu correo - GoFare</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1F2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F3F4F6; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" maxWidth="560" cellspacing="0" cellpadding="0" style="background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); max-width: 560px;">
          
          <tr>
            <td style="background-color: #0047FF; padding: 28px 30px; text-align: center;">
              <h1 style="color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 800;">GoFare</h1>
              <p style="color: #E0E7FF; margin: 4px 0 0 0; font-size: 14px;">Tu servicio de transporte seguro</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="color: #111827; margin-top: 0; margin-bottom: 16px; font-size: 22px; font-weight: 700; text-align: center;">
                ¡Bienvenido a GoFare!
              </h2>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
                Hola,
              </p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 24px;">
                Gracias por registrarte en GoFare. Para confirmar la cuenta vinculada a <strong style="color: #0047FF;">${userEmail}</strong> y comenzar a viajar, haz clic en el siguiente botón:
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a href="${verificationLink}" target="_blank" style="background-color: #0047FF; color: #FFFFFF; text-decoration: none; font-size: 18px; font-weight: bold; padding: 16px 32px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 6px rgba(0, 71, 255, 0.25);">
                      Confirmar Mi Correo Electrónico
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background-color: #EFF6FF; border-left: 4px solid #0047FF; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #1E40AF;">
                  <strong>💡 ¿No creaste esta cuenta?</strong> Si no realizaste este registro, puedes ignorar este mensaje con tranquilidad.
                </p>
              </div>

              <p style="font-size: 13px; color: #6B7280; line-height: 1.5; margin-top: 24px; text-align: center;">
                Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br>
                <a href="${verificationLink}" style="color: #0047FF; word-break: break-all;">${verificationLink}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #F9FAFB; padding: 20px 28px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0; font-size: 13px; color: #9CA3AF;">
                GoFare — Transporte Inteligente y Accesible
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Obtiene el enlace de recuperación de contraseña de Firebase vía REST.
 */
async function fetchFirebasePasswordResetLink(email: string): Promise<string | null> {
  try {
    const apiKey =
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY_IOS ||
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY_ANDROID ||
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

    if (!apiKey) return null;

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email,
        }),
      },
    );

    if (!response.ok) return null;
    const data = await response.json();
    if (data.oobCode) {
      return `https://gofare-app.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=${data.oobCode}`;
    }
    return null;
  } catch (err) {
    console.warn('[Resend] Error al solicitar OOB code de contraseña:', err);
    return null;
  }
}

/**
 * Obtiene el enlace de verificación de correo de Firebase vía REST.
 */
async function fetchFirebaseEmailVerificationLink(
  idToken?: string,
  email?: string,
): Promise<string | null> {
  try {
    const apiKey =
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY_IOS ||
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY_ANDROID ||
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

    if (!apiKey) return null;

    const payload: any = { requestType: 'VERIFY_EMAIL' };
    if (idToken) {
      payload.idToken = idToken;
    } else if (email) {
      payload.email = email;
    } else {
      return null;
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) return null;
    const data = await response.json();
    if (data.oobCode) {
      return `https://gofare-app.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=${data.oobCode}`;
    }
    return null;
  } catch (err) {
    console.warn('[Resend] Error al solicitar OOB code de verificación:', err);
    return null;
  }
}

/**
 * Envía el correo de recuperación de contraseña utilizando exclusivamente Resend (api.resend.com).
 */
export async function sendPasswordResetWithResend(email: string): Promise<void> {
  const trimmedEmail = email.trim().toLowerCase();

  const apiKeyToUse = RESEND_API_KEY?.trim();
  if (!apiKeyToUse) {
    throw new Error(
      'Para enviar el correo vía Resend, debes configurar EXPO_PUBLIC_RESEND_API_KEY en tu archivo .env.',
    );
  }

  console.log('[Resend] Generando enlace de recuperación para:', trimmedEmail);
  let actionLink = await fetchFirebasePasswordResetLink(trimmedEmail);

  if (!actionLink) {
    actionLink = `https://gofare-app.firebaseapp.com/__/auth/action?mode=resetPassword&email=${encodeURIComponent(trimmedEmail)}`;
  }

  const htmlBody = buildPasswordResetHtml(actionLink, trimmedEmail);

  console.log('[Resend] Enviando correo de recuperación vía api.resend.com...');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKeyToUse}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [trimmedEmail],
      subject: 'GoFare - Recupera tu contraseña',
      html: htmlBody,
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    console.error('[Resend] Error devuelto por la API de Resend:', errorPayload);
    throw new Error(
      errorPayload?.message ||
        errorPayload?.error ||
        'La API de Resend rechazó el envío del correo de recuperación.',
    );
  }

  console.log('[Resend] ¡Correo de recuperación enviado con éxito vía Resend!');
}

/**
 * Envía el correo de confirmación/verificación utilizando exclusivamente Resend (api.resend.com).
 */
export async function sendVerificationEmailWithResend(
  email: string,
  idToken?: string,
): Promise<void> {
  const trimmedEmail = email.trim().toLowerCase();

  const apiKeyToUse = RESEND_API_KEY?.trim();
  if (!apiKeyToUse) {
    throw new Error(
      'Para enviar el correo vía Resend, debes configurar EXPO_PUBLIC_RESEND_API_KEY en tu archivo .env.',
    );
  }

  const tokenToUse = idToken || (await auth.currentUser?.getIdToken());
  let actionLink = await fetchFirebaseEmailVerificationLink(tokenToUse, trimmedEmail);

  if (!actionLink) {
    actionLink = `https://gofare-app.firebaseapp.com/__/auth/action?mode=verifyEmail&email=${encodeURIComponent(trimmedEmail)}`;
  }

  const htmlBody = buildVerificationEmailHtml(actionLink, trimmedEmail);

  console.log('[Resend] Enviando correo de verificación vía api.resend.com...');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKeyToUse}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [trimmedEmail],
      subject: 'GoFare - Confirma tu correo electrónico',
      html: htmlBody,
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    console.error('[Resend] Error devuelto por la API de Resend:', errorPayload);
    throw new Error(
      errorPayload?.message ||
        errorPayload?.error ||
        'La API de Resend rechazó el envío del correo de confirmación.',
    );
  }

  console.log('[Resend] ¡Correo de verificación enviado con éxito vía Resend!');
}
