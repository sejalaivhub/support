import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import net from 'node:net';
import tls from 'node:tls';

function sendSmtpNative(opts: {
  host: string;
  port: number;
  user: string;
  pass: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { host, port, user, pass, to, subject, text } = opts;
    const isSecurePort = port === 465;

    let socket: any;
    let step = 0;
    let finished = false;

    const cleanup = () => {
      if (socket && !socket.destroyed) {
        try { socket.destroy(); } catch (e) {}
      }
    };

    const authUserB64 = Buffer.from(user).toString('base64');
    const authPassB64 = Buffer.from(pass).toString('base64');

    const handleData = (data: Buffer) => {
      if (finished) return;
      const response = data.toString();
      console.log(`[SMTP RAW RESPONSE]: ${response.trim()}`);

      const code = parseInt(response.slice(0, 3), 10);
      if (isNaN(code) || code >= 400) {
        finished = true;
        cleanup();
        return reject(new Error(`SMTP Server Error (${code || 'Unknown'}): ${response.trim()}`));
      }

      if (step === 0 && code === 220) {
        step = 1;
        socket.write(`EHLO aivhub.com\r\n`);
      } else if (step === 1 && code === 250) {
        if (isSecurePort) {
          step = 3;
          socket.write(`AUTH LOGIN\r\n`);
        } else if (response.includes('STARTTLS') || response.includes('250')) {
          step = 2;
          socket.write(`STARTTLS\r\n`);
        } else {
          step = 3;
          socket.write(`AUTH LOGIN\r\n`);
        }
      } else if (step === 2 && code === 220) {
        socket.removeAllListeners('data');
        const tlsSocket = tls.connect({
          socket: socket,
          host: host,
          rejectUnauthorized: false,
        });

        socket = tlsSocket;
        socket.on('data', handleData);
        socket.on('error', (err: any) => {
          if (!finished) { finished = true; cleanup(); reject(err); }
        });

        step = 2.5;
        socket.write(`EHLO aivhub.com\r\n`);
      } else if (step === 2.5 && code === 250) {
        step = 3;
        socket.write(`AUTH LOGIN\r\n`);
      } else if (step === 3 && code === 334) {
        step = 4;
        socket.write(`${authUserB64}\r\n`);
      } else if (step === 4 && code === 334) {
        step = 5;
        socket.write(`${authPassB64}\r\n`);
      } else if (step === 5 && code === 235) {
        step = 6;
        socket.write(`MAIL FROM:<${user}>\r\n`);
      } else if (step === 6 && code === 250) {
        step = 7;
        socket.write(`RCPT TO:<${to}>\r\n`);
      } else if (step === 7 && code === 250) {
        step = 8;
        socket.write(`DATA\r\n`);
      } else if (step === 8 && code === 354) {
        step = 9;
        const contentType = opts.html ? `Content-Type: text/html; charset=UTF-8` : `Content-Type: text/plain; charset=UTF-8`;
        const bodyContent = opts.html ? opts.html : (opts.text || '');

        const mimeLines = [
          `From: "AIV Support" <${user}>`,
          `To: <${to}>`,
          `Subject: ${subject}`,
          `Date: ${new Date().toUTCString()}`,
          contentType,
          `MIME-Version: 1.0`,
          ``,
          bodyContent,
          `.`,
          ``,
        ];
        socket.write(mimeLines.join('\r\n'));
      } else if (step === 9 && code === 250) {
        step = 10;
        finished = true;
        socket.write(`QUIT\r\n`);
        cleanup();
        resolve(response.trim());
      }
    };

    try {
      if (isSecurePort) {
        socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
          console.log(`[SMTP Connected SSL/TLS to ${host}:${port}]`);
        });
      } else {
        socket = net.createConnection({ host, port }, () => {
          console.log(`[SMTP Connected TCP to ${host}:${port}]`);
        });
      }

      socket.on('data', handleData);
      socket.on('error', (err: any) => {
        if (!finished) {
          finished = true;
          cleanup();
          console.error('[SMTP SOCKET ERROR]:', err);
          reject(err);
        }
      });

      socket.setTimeout(20000, () => {
        if (!finished) {
          finished = true;
          cleanup();
          reject(new Error(`SMTP connection timed out after 20s (${host}:${port})`));
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

function smtpEmailPlugin(): Plugin {
  return {
    name: 'smtp-email-plugin',
    configureServer(server) {
      server.middlewares.use('/api/send-email', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const { host, port, user, pass, to, subject, text, html } = data;

            const smtpHost = host || process.env.SMTP_HOST || 'send.one.com';
            const smtpPort = Number(port || process.env.SMTP_PORT || 587);
            const smtpUser = user || process.env.SMTP_USER || 'hello@aivhub.com';
            const smtpPass = pass || process.env.SMTP_PASS || 'A!vHub@01$';
            const recipient = to || 'hello@aivhub.com';

            console.log(`[SMTP DISPATCH ATTEMPT] Sending to ${recipient} via ${smtpHost}:${smtpPort} (${smtpUser})...`);

            const result = await sendSmtpNative({
              host: smtpHost,
              port: smtpPort,
              user: smtpUser,
              pass: smtpPass,
              to: recipient,
              subject: subject || 'Ticket Creation Acknowledgement',
              text: text,
              html: html,
            });

            console.log(`[SMTP DISPATCH SUCCESS] Result: ${result}`);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, result, host: smtpHost }));
          } catch (error: any) {
            console.error('[SMTP EMAIL SERVER ERROR]:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: error.message || 'SMTP Socket Error' }));
          }
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), smtpEmailPlugin()],
  server: {
    host: '0.0.0.0',
    port: 8092,
    proxy: {
      '/auth': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:8095',
        changeOrigin: true,
      },
      '/rest': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:8095',
        changeOrigin: true,
      },
      '/api': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:8095',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 8092,
    proxy: {
      '/auth': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:8095',
        changeOrigin: true,
      },
      '/rest': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:8095',
        changeOrigin: true,
      },
      '/api': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:8095',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});

