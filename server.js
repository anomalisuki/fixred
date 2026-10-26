const http = require('http');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Fungsi untuk membaca kredensial dari file eksternal
const getCredentials = () => {
    try {
        const emailPath = path.join(__dirname, 'email.txt');
        const passPath = path.join(__dirname, 'pass.txt');
        
        const email = fs.readFileSync(emailPath, 'utf8').trim();
        const pass = fs.readFileSync(passPath, 'utf8').trim();
        return { email, pass };
    } catch (error) {
        return { email: '', pass: '' };
    }
};

const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/send') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const rawInput = data.phone || '';

                // Memecah input berdasarkan baris baru (\n)
                const lines = rawInput.split(/\r?\n/);
                
                let processedPhones = [];
                for (let line of lines) {
                    let cleaned = line.replace(/[^0-9+]/g, '');
                    if (cleaned) {
                        if (!cleaned.startsWith('+')) {
                            cleaned = '+' + cleaned;
                        }
                        processedPhones.push(cleaned);
                    }
                }

                // Membatasi maksimal 5 nomor (sehingga total maksimal 5 email)
                if (processedPhones.length > 5) {
                    processedPhones = processedPhones.slice(0, 5);
                }

                if (processedPhones.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Tidak ada nomor telepon valid yang dimasukkan.' }));
                    return;
                }

                const { email: GMAIL_USER, pass: GMAIL_APP_PASSWORD } = getCredentials();
                if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
                    throw new Error('Kredensial di email.txt atau pass.txt belum diatur dengan benar.');
                }

                // Konfigurasi transporter Nodemailer
                const transporter = nodemailer.createTransport({
                    host: 'smtp.gmail.com',
                    port: 465,
                    secure: true,
                    auth: {
                        user: GMAIL_USER,
                        pass: GMAIL_APP_PASSWORD
                    }
                });

                await transporter.verify();

                let sentCount = 0;
                let sentPhones = [];

                // Mengirim tepat 1 email untuk masing-masing nomor (maksimal 5 nomor / 5 email)
                for (let phone of processedPhones) {
                    const arabicText = `السلام عليكم ورحمة الله وبركاته

أود أن أستعرض المشاكل التي [AkunSuki] اسمي أواجهها

"Login not available now" لقد حاولت التحقق من الرقم ولكن هناك نص عندما أكون مالك الرقم، يرجى مراجعته على الفور. هذا هو رقمي

${phone}

السلام عليكم ورحمة الله وبركاته، شكراً لكم.`;

                    const mailOptions = {
                        from: GMAIL_USER,
                        to: 'support@support.whatsapp.com',
                        subject: 'Login Not Available',
                        text: arabicText
                    };

                    await transporter.sendMail(mailOptions);
                    sentCount++;
                    sentPhones.push(phone);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: `Berhasil mengirim ${sentCount} email (masing-masing 1 email per nomor).`,
                    sentCount: sentCount,
                    phones: sentPhones 
                }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            }
        });
        return;
    }

    // Melayani file statis dari folder 'public'
    let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    let extname = path.extname(filePath);
    let contentType = 'text/html';

    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            fs.readFile(path.join(__dirname, 'public', 'index.html'), (err2, content2) => {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content2, 'utf8');
            });
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf8');
        }
    });
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server berjalan di http://localhost:${PORT}`);
    });
}

module.exports = server;
