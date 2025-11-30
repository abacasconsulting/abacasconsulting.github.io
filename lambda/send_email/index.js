const sgMail = require('@sendgrid/mail');

const secret = process.env.SENDGRID_API_KEY;
sgMail.setApiKey(secret);

exports.handler = async (event) => {
    const { name, email, message, phone } = JSON.parse(event.body || '{}');

    const msg = {
        to: 'abacas181@gmail.com', // User's email
        from: 'abacas181@gmail.com', // Verified sender (assuming this is verified)
        subject: `New Contact Form Submission from ${name}`,
        text: `
      Name: ${name}
      Email: ${email}
      Phone: ${phone}
      
      Message:
      ${message}
    `,
        html: `
      <h3>New Contact Form Submission</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <br/>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `,
    };

    try {
        await sgMail.send(msg);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Email sent successfully' }),
        };
    } catch (error) {
        console.error(error);
        if (error.response) {
            console.error(error.response.body);
        }
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send email', details: error.message }),
        };
    }
};
