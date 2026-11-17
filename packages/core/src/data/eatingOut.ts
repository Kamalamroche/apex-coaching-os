/** Original APEX tips for eating out in the UK. Plain advice, no brands. */
export interface EatingOutGuide {
  id: string;
  title: string;
  /** One line under the title. */
  lead: string;
  picks: string[];
  watch: string[];
  tip: string;
}

export const EATING_OUT: EatingOutGuide[] = [
  {
    id: "pub", title: "Pub", lead: "Big plates, easy to go over without noticing.",
    picks: ["Grilled chicken or fish with new potatoes and veg", "Steak with salad instead of chips, or share the chips", "Roast dinner: lean meat, extra veg, go easy on the gravy"],
    watch: ["Battered fish, pies and anything with a pastry lid", "Creamy sauces and cheesy toppings", "Pints add up: a pint of lager is about 200 kcal"],
    tip: "Order a side of veg or salad first, then decide on the rest.",
  },
  {
    id: "indian", title: "Indian", lead: "Lots of good protein if you pick the dry dishes.",
    picks: ["Tandoori chicken, chicken tikka or fish tikka", "Dal or chana masala for a plant-based option", "Plain rice or one chapati instead of naan"],
    watch: ["Korma, masala and makhani sauces: cream and butter", "Pilau rice, peshwari naan and bhajis", "Poppadoms with dips before the meal arrives"],
    tip: "Pick one carb: rice or bread, not both.",
  },
  {
    id: "chinese", title: "Chinese", lead: "Steamed and stir-fried beats battered and sweet.",
    picks: ["Chicken, beef or prawn with mixed veg in black bean or garlic sauce", "Steamed fish or dumplings", "Boiled rice instead of egg fried rice"],
    watch: ["Sweet and sour, crispy chilli beef and anything battered", "Prawn crackers and spring rolls", "Thick sticky sauces: ask for sauce on the side"],
    tip: "Fill half your plate with veg dishes and share the rest.",
  },
  {
    id: "italian", title: "Italian", lead: "Tomato sauces and grilled mains are your friend.",
    picks: ["Pasta in a tomato or seafood sauce (a starter portion is often plenty)", "Grilled chicken or fish with salad", "Thin-crust pizza with chicken or ham and veg, plus a side salad"],
    watch: ["Carbonara, alfredo and other creamy sauces", "Garlic bread with cheese before the main", "Deep-pan and stuffed-crust pizza"],
    tip: "Ask for extra veg on your pizza and skip the extra cheese.",
  },
  {
    id: "mexican", title: "Mexican", lead: "Build a bowl and you stay in control.",
    picks: ["Burrito bowl: rice or beans, chicken or steak, salsa, lettuce", "Chicken or prawn fajitas with two tortillas", "Black beans for protein and fibre"],
    watch: ["Sour cream, cheese and guacamole together: pick one", "Nachos with toppings", "Big flour tortilla burritos: about 300 kcal before the filling"],
    tip: "Go bowl instead of burrito to save around 300 kcal.",
  },
  {
    id: "japanese", title: "Japanese and sushi", lead: "One of the easiest places to eat well.",
    picks: ["Sashimi, nigiri and simple rolls", "Edamame and miso soup", "Teriyaki salmon or chicken with rice"],
    watch: ["Tempura and katsu: fried in batter or crumbs", "Rolls with mayo sauces", "Lots of rice if you're on a low-carb day"],
    tip: "Start with edamame for an easy 10 g of protein.",
  },
  {
    id: "cafe", title: "Coffee shop", lead: "Drinks and pastries hide a lot of calories.",
    picks: ["Flat white, latte or americano with semi-skimmed milk", "Porridge, a protein box or an egg wrap", "Fruit pot or yogurt"],
    watch: ["Syrups, whipped cream and iced 'frappe' drinks", "Muffins, croissants and big cookies", "Paninis with lots of cheese"],
    tip: "A latte is a decent hit of protein. Skip the syrup and it fits most plans.",
  },
  {
    id: "burger", title: "Burger and fast food", lead: "It can fit. Choose the size, not just the item.",
    picks: ["Single grilled chicken or plain burger", "Side salad, corn or a small fries", "Water, diet drink or sparkling water"],
    watch: ["Double patties with cheese and bacon", "Large fries and milkshakes", "Creamy dips and sauces"],
    tip: "Order the small meal, or the burger on its own and eat it slowly.",
  },
  {
    id: "mealdeal", title: "Supermarket lunch", lead: "Quick and easy to get right.",
    picks: ["Chicken, tuna or egg salad, or a high-protein sandwich", "Protein pot, yogurt or fruit as the snack", "Water or a no-sugar drink"],
    watch: ["Sandwiches with mayo, bacon and cheese together", "Crisps and chocolate as the snack", "Smoothies: lots of sugar for the size"],
    tip: "Read the protein number first. Aim for 25 g or more from the main.",
  },
];
