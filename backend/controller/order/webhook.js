const stripe = require('../../config/stripe');
const orderModel = require('../../models/orderProductModel');
const addToCartModel = require('../../models/cartProduct');

const endpointSecret = process.env.STRIPE_ENPOINT_WEBHOOK_SECRET_KEY;

async function getLineItems(lineItems) {
  const productItems = [];

  for (const item of lineItems.data) {
    const product = await stripe.products.retrieve(item.price.product);

    productItems.push({
      productId: product.metadata.productId,
      name: product.name,
      price: item.price.unit_amount / 100,
      quantity: item.quantity,
      image: product.images,
    });
  }

  return productItems;
}

const webhooks = async (request, response) => {
  const sig = request.headers["stripe-signature"];
  let event;

  try {
    // ✅ Use raw body directly
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Stripe Signature Verification Failed:", err.message);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Handle the successful session
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    if (session.payment_status !== 'paid') {
      console.log("⛔ Not a paid session. Skipping save.");
      return response.status(200).send("Not paid.");
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const productDetails = await getLineItems(lineItems);

    const order = new orderModel({
      productDetails,
      email: session.customer_email,
      userId: session.metadata.userId,
      paymentDetails: {
        paymentId: session.payment_intent,
        payment_method_type: session.payment_method_types,
        payment_status: session.payment_status,
      },
      shipping_options: [
        {
          shipping_rate: session.shipping_cost.shipping_rate,
          shipping_amount: session.total_details.amount_shipping / 100,
        },
      ],
      totalAmount: session.amount_total / 100,
    });

    const savedOrder = await order.save();
    if (savedOrder?._id) {
      await addToCartModel.deleteMany({ userId: session.metadata.userId });
      console.log("✅ Order saved and cart cleared.");
    }
  }

  response.status(200).send("Webhook received.");
};

module.exports = webhooks;
