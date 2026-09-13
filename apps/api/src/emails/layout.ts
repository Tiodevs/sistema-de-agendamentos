import { BRAND, escapeHtml } from './brand';
import { EMAIL_IMAGES, imageSrc } from './assets';

export interface EmailDetail {
  label: string;
  value: string;
}

export interface BrandedEmailInput {
  preview: string;
  title: string;
  greeting: string;
  intro: string;
  details?: EmailDetail[];
  cta?: { label: string; href: string };
  footnote?: string;
  useCidImages?: boolean;
}

function font(size: number, lineHeight: number, color: string, extra = '') {
  return [
    `font-family:Arial,Helvetica,sans-serif`,
    `font-size:${size}px`,
    `line-height:${lineHeight}px`,
    `color:${color}`,
    extra,
  ]
    .filter(Boolean)
    .join(';');
}

function detailRows(details: EmailDetail[]) {
  return details
    .map((detail, index) => {
      const last = index === details.length - 1;
      const border = last
        ? ''
        : `border-bottom-width:1px;border-bottom-style:solid;border-bottom-color:${BRAND.line};`;

      return `
        <tr>
          <td style="padding-top:12px;padding-right:0;padding-bottom:12px;padding-left:0;${border}">
            <p style="${font(12, 16, BRAND.muted)};margin-top:0;margin-right:0;margin-bottom:4px;margin-left:0;text-transform:uppercase;letter-spacing:0.6px;">
              ${escapeHtml(detail.label)}
            </p>
            <p style="${font(16, 22, BRAND.text, 'font-weight:bold')};margin-top:0;margin-right:0;margin-bottom:0;margin-left:0;">
              ${escapeHtml(detail.value)}
            </p>
          </td>
        </tr>`;
    })
    .join('');
}

export function renderBrandedEmail({
  preview,
  title,
  greeting,
  intro,
  details = [],
  cta,
  footnote,
  useCidImages = true,
}: BrandedEmailInput) {
  const headerSrc = imageSrc(EMAIL_IMAGES.header, useCidImages);
  const markSrc = imageSrc(EMAIL_IMAGES.mark, useCidImages);
  const year = new Date().getFullYear();
  const detailsBlock =
    details.length === 0
      ? ''
      : `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;margin-bottom:24px;">
          <tr>
            <td width="4" bgcolor="${BRAND.accent}" style="width:4px;background-color:${BRAND.accent};font-size:0;line-height:0;">&nbsp;</td>
            <td bgcolor="${BRAND.card}" style="background-color:${BRAND.card};padding-top:8px;padding-right:20px;padding-bottom:8px;padding-left:20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${detailRows(details)}
              </table>
            </td>
          </tr>
        </table>`;

  const ctaBlock = cta
    ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;margin-bottom:8px;">
          <tr>
            <td bgcolor="${BRAND.accent}" style="background-color:${BRAND.accent};border-radius:8px;">
              <a href="${escapeHtml(cta.href)}" style="${font(16, 20, BRAND.accentForeground, 'font-weight:bold')};display:inline-block;text-decoration:none;padding-top:14px;padding-right:28px;padding-bottom:14px;padding-left:28px;">
                ${escapeHtml(cta.label)}
              </a>
            </td>
          </tr>
        </table>`
    : '';

  const footnoteBlock = footnote
    ? `<p style="${font(14, 22, BRAND.muted)};margin-top:24px;margin-right:0;margin-bottom:0;margin-left:0;">${escapeHtml(footnote)}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin-top:0;margin-right:0;margin-bottom:0;margin-left:0;padding-top:0;padding-right:0;padding-bottom:0;padding-left:0;background-color:${BRAND.page};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.page};">
      ${escapeHtml(preview)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.page}" style="background-color:${BRAND.page};">
      <tr>
        <td align="center" style="padding-top:32px;padding-right:16px;padding-bottom:32px;padding-left:16px;">
          <!--[if mso]>
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td>
          <![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
            <tr>
              <td bgcolor="${BRAND.ink}" style="background-color:${BRAND.ink};padding-top:0;padding-right:0;padding-bottom:0;padding-left:0;">
                <img src="${headerSrc}" alt="${BRAND.name}" width="600" height="338" border="0" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
              </td>
            </tr>
            <tr>
              <td bgcolor="${BRAND.accent}" height="4" style="background-color:${BRAND.accent};height:4px;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td bgcolor="${BRAND.white}" style="background-color:${BRAND.white};padding-top:32px;padding-right:32px;padding-bottom:32px;padding-left:32px;">
                <h1 style="${font(26, 32, BRAND.ink, 'font-weight:bold')};margin-top:0;margin-right:0;margin-bottom:16px;margin-left:0;">
                  ${escapeHtml(title)}
                </h1>
                <p style="${font(16, 24, BRAND.text)};margin-top:0;margin-right:0;margin-bottom:12px;margin-left:0;">
                  ${escapeHtml(greeting)}
                </p>
                <p style="${font(16, 24, BRAND.text)};margin-top:0;margin-right:0;margin-bottom:24px;margin-left:0;">
                  ${escapeHtml(intro)}
                </p>
                ${detailsBlock}
                ${ctaBlock}
                ${footnoteBlock}
              </td>
            </tr>
            <tr>
              <td bgcolor="${BRAND.ink}" style="background-color:${BRAND.ink};padding-top:24px;padding-right:32px;padding-bottom:24px;padding-left:32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right:12px;vertical-align:middle;">
                      <img src="${markSrc}" alt="" width="40" height="40" border="0" style="display:block;width:40px;height:40px;border:0;">
                    </td>
                    <td style="vertical-align:middle;">
                      <p style="${font(16, 20, BRAND.white, 'font-weight:bold')};margin-top:0;margin-right:0;margin-bottom:4px;margin-left:0;">${BRAND.name}</p>
                      <p style="${font(13, 18, BRAND.accent)};margin-top:0;margin-right:0;margin-bottom:0;margin-left:0;">Agendamentos online</p>
                    </td>
                  </tr>
                </table>
                <p style="${font(12, 18, '#8AA0A6')};margin-top:16px;margin-right:0;margin-bottom:0;margin-left:0;">
                  Este e-mail foi enviado automaticamente pela ${BRAND.name}. © ${year}
                </p>
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textParts = [
    title,
    '',
    greeting,
    intro,
    '',
    ...details.map((detail) => `${detail.label}: ${detail.value}`),
    cta ? `\n${cta.label}: ${cta.href}` : '',
    footnote ? `\n${footnote}` : '',
    `\n${BRAND.name} — agendamentos online`,
  ].filter((part) => part !== undefined);

  return {
    html,
    text: textParts
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  };
}
