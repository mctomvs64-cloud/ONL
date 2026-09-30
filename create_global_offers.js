const token = "2ox8phHYN9DUVMLdRl06uRr6FgprkMA9fMKI6FhX9CbK9EINvo09Uv49p4bp";
const productHash = "cy381vdbuj"; // Evelyn Oliver VIP Global

const plansToCreate = [
  // BR
  { title: "VIP Semanal BR", price: 2499, country: "BR", period: "weekly" },
  { title: "VIP Mensal BR", price: 6499, country: "BR", period: "monthly" },
  { title: "VIP Anual BR", price: 19799, country: "BR", period: "annual" },
  // USD
  { title: "VIP Weekly USD", price: 699, country: "US", period: "weekly" },
  { title: "VIP Monthly USD", price: 1499, country: "US", period: "monthly" },
  { title: "VIP Annual USD", price: 4499, country: "US", period: "annual" },
  // EUR
  { title: "VIP Weekly EUR", price: 699, country: "FR", period: "weekly" },
  { title: "VIP Monthly EUR", price: 1499, country: "FR", period: "monthly" },
  { title: "VIP Annual EUR", price: 4499, country: "FR", period: "annual" },
  // GBP
  { title: "VIP Weekly GBP", price: 599, country: "GB", period: "weekly" },
  { title: "VIP Monthly GBP", price: 1299, country: "GB", period: "monthly" },
  { title: "VIP Annual GBP", price: 3499, country: "GB", period: "annual" },
  // MXN
  { title: "VIP Semanal MXN", price: 7900, country: "MX", period: "weekly" },
  { title: "VIP Mensal MXN", price: 19900, country: "MX", period: "monthly" },
  { title: "VIP Anual MXN", price: 59900, country: "MX", period: "annual" }
];

async function run() {
  const mapping = {};
  
  for (const plan of plansToCreate) {
    const res = await fetch(`https://api.ironpayapp.com.br/api/public/v1/products/${productHash}/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_token: token,
        title: plan.title,
        price: plan.price
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (!mapping[plan.country]) mapping[plan.country] = {};
      mapping[plan.country][plan.period] = data.hash;
      console.log(`Created ${plan.title}: ${data.hash}`);
    } else {
      console.error(`Failed ${plan.title}:`, await res.text());
    }
  }
  
  console.log("\nNew MAPPING:");
  console.log(JSON.stringify(mapping, null, 2));
}

run();
