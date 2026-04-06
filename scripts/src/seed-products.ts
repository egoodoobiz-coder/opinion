import { getUncachableStripeClient } from "../../artifacts/api-server/src/stripeClient";

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  console.log("Creating Opinion premium plans in Stripe...");

  // Check if Company Plan already exists
  const existing = await stripe.products.search({
    query: "name:'Company Plan' AND active:'true'",
  });

  if (existing.data.length > 0) {
    console.log("Company Plan already exists. Skipping.");
    console.log(`Existing product ID: ${existing.data[0].id}`);
    return;
  }

  // Company Plan
  const companyProduct = await stripe.products.create({
    name: "Company Plan",
    description: "Verified company account with analytics and promoted topics",
    metadata: { accountType: "company" },
  });
  console.log(`Created product: ${companyProduct.name} (${companyProduct.id})`);

  const companyPrice = await stripe.prices.create({
    product: companyProduct.id,
    unit_amount: 999,
    currency: "usd",
    recurring: { interval: "month" },
  });
  console.log(`Created price: $9.99/month (${companyPrice.id})`);

  // Celebrity Plan
  const celebrityProduct = await stripe.products.create({
    name: "Celebrity Plan",
    description: "Verified celebrity account with analytics and promoted topics",
    metadata: { accountType: "celebrity" },
  });
  console.log(`Created product: ${celebrityProduct.name} (${celebrityProduct.id})`);

  const celebrityPrice = await stripe.prices.create({
    product: celebrityProduct.id,
    unit_amount: 1999,
    currency: "usd",
    recurring: { interval: "month" },
  });
  console.log(`Created price: $19.99/month (${celebrityPrice.id})`);

  console.log("Done! Products created in Stripe.");
}

createProducts().catch((err) => {
  console.error(err);
  process.exit(1);
});
