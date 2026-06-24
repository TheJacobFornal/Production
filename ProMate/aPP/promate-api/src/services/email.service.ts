import nodemailer from 'nodemailer'

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp-mail.outlook.com',
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: false,   // Outlook używa STARTTLS na porcie 587, nie SSL
    tls:    { ciphers: 'SSLv3' },
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  })
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
  const transport = createTransport()

  await transport.sendMail({
    from:    process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'ProMate — resetowanie hasła',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border-radius:12px;padding:12px 20px;">
            <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">ProMate</span>
          </div>
        </div>

        <div style="background:#fff;border-radius:8px;padding:28px 24px;border:1px solid #e2e8f0;">
          <p style="margin:0 0 16px;font-size:15px;color:#111827;">Cześć <strong>${name}</strong>,</p>
          <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
            Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w systemie ProMate.
            Kliknij przycisk poniżej, aby ustawić nowe hasło.
          </p>

          <div style="text-align:center;margin:28px 0;">
            <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;">
              Resetuj hasło
            </a>
          </div>

          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
            Link jest ważny przez <strong>2 godziny</strong>. Jeśli nie prosiłeś/aś o reset hasła, zignoruj tę wiadomość.
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#d1d5db;word-break:break-all;">
            ${resetUrl}
          </p>
        </div>
      </div>
    `,
  })
}
