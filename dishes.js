const RESTAURANT = {
  name: 'Melt9 Gulgasht Multan',       // shown in the browser tab title
  phone: '03160843627',                // "Call waiter" button
  whatsapp: '923160843627'             // WhatsApp contact number
};

const DISHES = {
  
  'mcart': {                                                      
    name: 'McArt Pizza',
    price: '1800', description: 'Freshly baked McArt signature pizza', ingredients: 'Cheese, Crust, Pizza Sauce, Savory Pepperoni', allergens: 'Gluten, Dairy',    
    glb:    'dishes/mcart_small-v1.glb',                          
    glbIos: 'dishes/mcart_ios-v1.glb',                           
    mind:   'dishes/mcart-targets.mind',                        
    poster: 'dishes/mcart-poster.jpg'                          
  },

  'Mr-Pizza': {                                                       
    name: 'MR-Pizza-Mayu',
    price: '1650', description: 'Creamy mayo garlic style signature crust', ingredients: 'Mayo Sauce, Grilled Chicken, Onions, Mozzarella', allergens: 'Gluten, Dairy',   
    glb:    'dishes/mr_pizza_small-v1.glb',                      
    glbIos: 'dishes/mr_pizza_ios-v1.glb',                       
    mind:   'dishes/mr-pizza-target.mind',                     
    poster: 'dishes/mr-pizza-poster.jpg'                      
  },

  'VegPizza': {                                                       
    name: 'MR-VegPizza',
    price: '1599', description: 'Fresh vegetables on a hand-stretched base', ingredients: 'Mushroom, capsicum, olives, onion, mozzarella', allergens: 'Gluten, Dairy',   
    glb:    'dishes/VegPizza_small-v1.glb',                      
    glbIos: 'dishes/VegPizza_ios-v1.glb',                       
    mind:   'dishes/VegPizza.mind',                     
    poster: 'dishes/VegPizzaimage.jpg'                      
  }

};

// >>> NEW PIPELINE FUNCTION: Sends your active WebXR menu choice straight to Odoo
function placeOdooOrder() {
    // Paste your active live Ngrok forwarding URL address here from your black tunnel window
    const ODOO_API_ENDPOINT = "https://ngrok-free.app";

    const odooOrderPacket = {
        "params": {
            "data": {
                // If "Walk-in" is detected, sets table to false; otherwise maps to an integer (e.g. 7 or 8)
                "table_id": currentTableNumber === "Walk-in" ? false : parseInt(currentTableNumber), 
                "floor_id": 2, // Matches the Floor ID "2" we verified inside your URL settings
                "lines": [
                    [0, 0, {
                        "product_id": DISH.name, // Automatically sends "McArt Pizza", "MR-Pizza-Mayu", or "MR-VegPizza"
                        "qty": 1,
                        "price_unit": parseFloat(DISH.price) || 1800.00
                    }]
                ],
                "state": "draft" // Pushes it live directly into the active dashboard checkout session
            }
        }
    };

    fetch(ODOO_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(odooOrderPacket)
    })
    .then(response => response.json())
    .then(data => {
        console.log("Success confirmation from Odoo:", data);
        alert(`Success! Order for 1x ${DISH.name} has been sent straight to the kitchen from Table #${currentTableNumber}.`);
    })
    .catch(error => {
        console.error("Network communication failure:", error);
        alert("Order delivery timeout. Please check your network or call your server.");
    });
}

