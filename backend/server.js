require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { sequelize, Product, Order, OrderItem } = require('./models');
const Stripe = require('stripe');
const sgMail = require('@sendgrid/mail');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
app.use(cors());

// raw body for webhook
app.use((req,res,next) => {
  if (req.originalUrl === '/webhook') return next();
  bodyParser.json()(req,res,next);
});

// Public: products
app.get('/api/products', async (req,res) => {
  const products = await Product.findAll();
  res.json(products);
});

// Create checkout session
app.post('/api/create-checkout-session', async (req,res) => {
  try {
    const { items, customerEmail } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'Cart empty' });
    const line_items = [];
    let total = 0;
    for (const it of items) {
      const p = await Product.findByPk(it.id);
      if (!p) return res.status(400).json({ error: 'Product not found: ' + it.id });
      if (p.stock < it.quantity) return res.status(400).json({ error: `Insufficient stock for ${p.name}` });
      line_items.push({
        price_data:{
          currency:'usd',
          product_data:{ name: p.name, images: p.image_url ? [p.image_url] : [] },
          unit_amount: p.price_cents
        },
        quantity: it.quantity
      });
      total += p.price_cents * it.quantity;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types:['card'],
      mode:'payment',
      customer_email: customerEmail || undefined,
      line_items,
      success_url: (process.env.FRONTEND_SUCCESS_URL || 'http://localhost:3000') + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: (process.env.FRONTEND_CANCEL_URL || 'http://localhost:3000/checkout-cancel)'
    });

    const order = await Order.create({
      stripeSessionId: session.id,
      customerEmail: customerEmail || null,
      amount_cents: total,
      status: 'pending'
    });

    for (const it of items) {
      const p = await Product.findByPk(it.id);
      await OrderItem.create({
        OrderId: order.id,
        ProductId: p.id,
        name: p.name,
        price_cents: p.price_cents,
        quantity: it.quantity
      });
    }

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// simple success page
app.get('/api/checkout-success', async (req,res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) return res.status(400).send('Missing session_id');
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const order = await Order.findOne({ where: { stripeSessionId: sessionId } });
  if (order) {
    order.status = session.payment_status === 'paid' ? 'paid' : session.payment_status;
    await order.save();
  }
  res.send('<h1>Payment complete</h1><p>Thank you — your order is recorded.</p>');
});

// webhook
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req,res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook error', err.message);
    return res.status(400).send('Webhook error');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      const order = await Order.findOne({ where: { stripeSessionId: session.id } });
      if (order) {
        order.status = 'paid';
        await order.save();
        const items = await OrderItem.findAll({ where: { OrderId: order.id } });
        for (const it of items) {
          const p = await Product.findByPk(it.ProductId);
          if (p) {
            p.stock = Math.max(0, p.stock - it.quantity);
            await p.save();
          }
        }
        // send emails if sendgrid configured
        if (process.env.SENDGRID_API_KEY) {
          const customer = order.customerEmail || session.customer_email || null;
          const itemsHtml = items.map(it => `<li>${it.name} x ${it.quantity} — $${(it.price_cents*it.quantity/100).toFixed(2)}</li>`).join('');
          if (customer) {
            await sgMail.send({
              to: customer,
              from: process.env.EMAIL_FROM,
              subject: `Green zone — Order #${order.id} received`,
              html: `<p>Thanks — we received your payment. Order summary:</p><ul>${itemsHtml}</ul><p>Total: $${(order.amount_cents/100).toFixed(2)}</p>`
            });
          }
          if (process.env.ADMIN_EMAIL) {
            await sgMail.send({
              to: process.env.ADMIN_EMAIL,
              from: process.env.EMAIL_FROM,
              subject: `New paid order (#${order.id})`,
              html: `<p>Order #${order.id} — $${(order.amount_cents/100).toFixed(2)}</p><ul>${itemsHtml}</ul>`
            });
          }
        }
      }
    } catch (err) {
      console.error('Error handling completed session', err);
    }
  }

  res.json({received:true});
});

// admin middleware & routes
function adminAuth(req,res,next){
  const pass = req.headers['x-admin-password'] || req.body.adminPassword;
  if (!pass || pass !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/api/admin/product', adminAuth, async (req,res) => {
  const { name, description, price_cents, image_url, stock } = req.body;
  const p = await Product.create({ name, description, price_cents, image_url, stock: stock || 100 });
  res.json(p);
});
app.put('/api/admin/product/:id', adminAuth, async (req,res) => {
  const p = await Product.findByPk(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  await p.update(req.body);
  res.json(p);
});
app.delete('/api/admin/product/:id', adminAuth, async (req,res) => {
  const p = await Product.findByPk(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  await p.destroy();
  res.json({ success:true });
});
app.get('/api/admin/orders', adminAuth, async (req,res) => {
  const orders = await Order.findAll({ include:[OrderItem], order:[['createdAt','DESC']] });
  res.json(orders);
});
app.post('/api/admin/order/:id/ship', adminAuth, async (req,res) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  order.shipped = true;
  await order.save();
  res.json({ success:true });
});

const port = process.env.PORT || 4242;
(async () => { await sequelize.sync({ alter:true }); app.listen(port, ()=>console.log('Server on',port)); })();
