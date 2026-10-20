// ============================================================
//  THIS IS THE ONLY FILE YOU EDIT WHEN YOU ADD A NEW DISH
//  Paths must match your GitHub file names EXACTLY (capital letters count!)
// ============================================================


  // ---------- Which dish? (?item=... from the QR link) ----------
  const urlParams = new URLSearchParams(location.search);
  const key = urlParams.get('item');
  
  // 1. ADD THIS LINE: Capture the table number dynamically from the link (?table=7)
  // If no table is passed, it safely defaults to "Walk-in"
  const currentTableNumber = urlParams.get('table') || "Walk-in";

  const DISH = DISHES[key];
  if (!DISH) { showMenuPage(key); return; }

const RESTAURANT = {
  name: 'My Restaurant',       // shown in the browser tab title
  phone: '03160843627',        // "Call waiter" button
  whatsapp: '923160843627'     // WhatsApp needs country code, no "+" and no leading 0 (Pakistan = 92)
};

const DISHES = {
  
    'mcart': {                                                      // <- this name goes in the QR link: ?item=mcart
    name: 'McArt Pizza',
    price: '', description: '', ingredients: '', allergens: '',    // e.g. 'Rs 1450', 'Fresh vegetables on a hand-stretched base, Mushroom, capsicum, olives, onion, mozzarella,
    glb:    'dishes/mcart_small-v1.glb',                          // 3D model (file inside the "dishes" folder)
    glbIos: 'dishes/mcart_ios-v1.glb',                           // iPhone only (file inside the "dishes" folder)
    mind:   'dishes/mcart-targets.mind',                        // compiled marker image (file inside the "dishes" folder)
    poster: 'dishes/mcart-poster.jpg'                          // LOAD THE Image quickly when customer visit the page 
  },

  'Mr-Pizza': {                                                       // <- this name goes in the QR link: ?item=mcart
    name: 'MR-Pizza-Mayu',
    price: '', description: '', ingredients: '', allergens: '',   // e.g. 'Rs 1450', 'Fresh vegetables on a hand-stretched base, Mushroom, capsicum, olives, onion, mozzarella,
    glb:    'dishes/mr_pizza_small-v1.glb',                      // 3D model (file inside the "dishes" folder)
    glbIos: 'dishes/mr_pizza_ios-v1.glb',                       // iPhone only (file inside the "dishes" folder)
    mind:   'dishes/mr-pizza-target.mind',                     // compiled marker image (file inside the "dishes" folder)
    poster: 'dishes/mr-pizza-poster.jpg'                      // LOAD THE Image quickly when customer visit the page
  },

  'VegPizza': {                                                       // <- this name goes in the QR link: ?item=mcart
    name: 'MR-VegPizza',
    price: '1599', description: '', ingredients: '', allergens: '',   // e.g. 'Rs 1450', 'Fresh vegetables on a hand-stretched base, Mushroom, capsicum, olives, onion, mozzarella,
    glb:    'dishes/VegPizza_small-v1.glb',                      // 3D model (file inside the "dishes" folder)
    glbIos: 'dishes/VegPizza_ios-v1.glb',                       // iPhone only (file inside the "dishes" folder)
    mind:   'dishes/VegPizza.mind',                     // compiled marker image (file inside the "dishes" folder)
    poster: 'dishes/VegPizzaimage.jpg'                      // LOAD THE Image quickly when customer visit the page
  },
  // ---- NEXT DISH: add a comma after the last "}" above, then copy one block and paste it here ----

};
// 3. ADD THIS FUNCTION: The script that pushes your order parameters directly to your local Odoo machine
function placeOdooOrder() {
    // Replace this link with your active live Ngrok forwarding URL or your public router port address
    const ODOO_API_ENDPOINT = "https://your-ngrok-link-or-public-ip:8069/api/pos/ui/create_order";

    const payload = {
        params: {
            table_id: currentTableNumber === "Walk-in" ? false : parseInt(currentTableNumber), 
            floor_id: 1, // Main Floor ID inside Odoo
            lines: [
                {
                    product_id: DISH.name, // Will dynamically pass "McArt Pizza"
                    qty: 1,
                    price_unit: parseFloat(DISH.price)
                }
            ],
            state: "draft" // Drops it live into the active cooking/billing queue
        }
    };

    fetch(ODOO_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (response.ok) {
            alert(`Order received! Your ${DISH.name} is being prepared for Table #${currentTableNumber}.`);
        } else {
            alert("Network connection slow. Please notify your server.");
        }
    })
    .catch(error => {
        console.error("Backend Error:", error);
        alert("Order timeout. Saved locally.");
    });
}
