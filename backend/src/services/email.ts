import fs from 'fs';
import path from 'path';

export const sendEmail = async (to: string, subject: string, html: string) => {
  const logMessage = `
=========================================
Time: ${new Date().toISOString()}
To: ${to}
Subject: ${subject}
Content: ${html}
=========================================
`;
  console.log(`[Email Mock] Sent to: ${to} | Subject: ${subject}`);

  try {
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    fs.appendFileSync(path.join(logsDir, 'emails.log'), logMessage);
  } catch (error) {
    console.error('Failed to write mock email log:', error);
  }

  return true;
};
