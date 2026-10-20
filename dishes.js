// ============================================================
//  THIS IS THE ONLY FILE YOU EDIT WHEN YOU ADD A NEW DISH
//  Paths must match your GitHub file names EXACTLY (capital letters count!)
// ============================================================

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
