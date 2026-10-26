const http = require('http');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Fungsi untuk membaca daftar kredensial dari file eksternal
const getCredentialsList = () => {
    try {
        const emailPath = path.join(__dirname, 'email.txt');
        const passPath = path.join(__dirname, 'pass.txt');
        
        const emails = fs.readFileSync(emailPath, 'utf8').split(/\r?\n/).map(e => e.trim()).filter(Boolean);
        const passes = fs.readFileSync(passPath, 'utf8').split(/\r?\n/).map(p => p.trim()).filter(Boolean);
        
        let credentials = [];
        for (let i = 0; i < Math.min(emails.length, passes.length); i++) {
            credentials.push({ email: emails[i], pass: passes[i] });
        }
        return credentials;
    } catch (error) {
        return [];
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

                // Memecah input nomor berdasarkan baris baru
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

                // Membatasi maksimal 5 nomor
                if (processedPhones.length > 5) {
                    processedPhones = processedPhones.slice(0, 5);
                }

                if (processedPhones.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Tidak ada nomor telepon valid yang dimasukkan.' }));
                    return;
                }

                const credentialsList = getCredentialsList();
                if (credentialsList.length === 0) {
                    throw new Error('File email.txt atau pass.txt kosong / belum diatur dengan benar.');
                }

                let sentCount = 0;
                let sentDetails = [];

                // Mengirim email: masing-masing nomor menggunakan akun email yang berbeda secara berurutan
                for (let i = 0; i < processedPhones.length; i++) {
                    const phone = processedPhones[i];
                    // Mengambil akun berdasarkan indeks (jika nomor > jumlah akun, akan berputar kembali ke akun pertama menggunakan % length)
                    const cred = credentialsList[i % credentialsList.length];

                    const arabicText = `السلام عليكم ورحمة الله وبركاته

أود أن أستعرض المشاكل التي [AkunSuki] اسمي أواجهها

"Login not available now" لقد حاولت التحقق من الرقم ولكن هناك نص عندما أكون مالك الرقم، يرجى مراجعته على الفور. هذا هو رقمي

${phone}

السلام عليكم ورحمة الله وبركاته، شكراً لكم.`;

                    const transporter = nodemailer.createTransport({
                        host: 'smtp.gmail.com',
                        port: 465,
                        secure: true,
                        auth: {
                            user: cred.email,
                            pass: cred.pass
                        }
                    });

                    await transporter.verify();

                    const mailOptions = {
                        from: cred.email,
                        to: 'android@support.whatsapp.com',
                        subject: 'Login Not Available',
                        text: arabicText
                    };

                    await transporter.sendMail(mailOptions);
                    sentCount++;
                    sentDetails.push(`Nomor ${phone} dikirim via ${cred.email}`);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: `Berhasil mengirim ${sentCount} email menggunakan akun berbeda.`,
                    sentCount: sentCount,
                    details: sentDetails 
                }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            }
        });
        return;
    }

    // Melayani file statis dari folder 'public'
    let filePath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
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
