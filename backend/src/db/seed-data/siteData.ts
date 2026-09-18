// Copied from the original hardcoded storefront catalogue at the point the
// database took over. This is seed input, not live data — edit the catalogue
// through the admin panel, not here. See docs/MIGRATION.md §6.

import { CustomerReview } from '@sv/shared';

export interface IngredientStory {
  id: string;
  name: string;
  regionalName: string;
  botanicalName: string;
  role: string;
  description: string;
  flavorNote: string;
  image: string;
}

export const INGREDIENTS_STORY: IngredientStory[] = [
  {
    id: 'coriander',
    name: 'Coriander Seeds',
    regionalName: 'ಕೊತ್ತಂಬರಿ ಬೀಜ (Dhania)',
    botanicalName: 'Coriandrum sativum',
    role: 'The Foundation Body & Citrus Aroma',
    description: 'Heirloom small-grain coriander seeds, carefully shade-dried and lightly pan-roasted to release crisp, citrusy, and gently sweet aromatic essential oils.',
    flavorNote: 'Citrusy, floral, and warming with gentle sweetness.',
    image: '/images/gallery_sun_dried_spices.jpg',
  },
  {
    id: 'cumin',
    name: 'Whole Cumin',
    regionalName: 'ಜೀರಿಗೆ (Jeera)',
    botanicalName: 'Cuminum cyminum',
    role: 'Digestive Warmth & Earthiness',
    description: 'Cleaned and stone-milled whole jeera that provides the deep, appetizing smoky backbone to our Rasam and Sambar blends while gently soothing digestion.',
    flavorNote: 'Nutty, earthy, and warm with an appetizing aroma.',
    image: '/images/recipe_vegetable_sambar.jpg',
  },
  {
    id: 'black-pepper',
    name: 'Tellicherry Black Pepper',
    regionalName: 'ಕಾಳು ಮೆಣಸು (Menasu)',
    botanicalName: 'Piper nigrum',
    role: 'Throat-Soothing Heat & Clarity',
    description: 'Plump black peppercorns from Malabar hills, celebrated as the King of Spices. Delivers a clean, sharp, resonant heat that warms the chest on rainy monsoon evenings.',
    flavorNote: 'Pungent, woodsy, and spicy with sharp clarity.',
    image: '/images/recipe_puliyogare_rice.jpg',
  },
  {
    id: 'red-chilli',
    name: 'Karnataka Byadagi Chilli',
    regionalName: 'ಬ್ಯಾಡಗಿ ಮೆಣಸಿನಕಾಯಿ',
    botanicalName: 'Capsicum annuum',
    role: 'Lustrous Crimson Hue & Gentle Heat',
    description: 'Wrinkled ruby-red chillies sun-dried on clean mats. Imparts our powders with glorious natural red hue without causing uncomfortably sharp stomach heat.',
    flavorNote: 'Fruity, mild pungency with deep color extraction.',
    image: '/images/gallery_byadagi_chillies.jpg',
  },
  {
    id: 'tamarind',
    name: 'Aged Country Tamarind',
    regionalName: 'ಹುಣಸೆಹಣ್ಣು (Hunase Hannu)',
    botanicalName: 'Tamarindus indica',
    role: 'Rich Tangy Sourness & Depth',
    description: 'Dark, seedless aged country tamarind that forms the sour soul of South Indian rasam, puliyogare, and sambar, balanced harmoniously with spices and jaggery.',
    flavorNote: 'Tangy, fruity, tart, and deeply appetizing.',
    image: '/images/recipe_tomato_rasam.jpg',
  },
  {
    id: 'curry-leaves',
    name: 'Fresh Farm Curry Leaves',
    regionalName: 'ಕರಿಬೇವು (Karibevu)',
    botanicalName: 'Murraya koenigii',
    role: 'Herbal Essence & Traditional Aroma',
    description: 'Handpicked fresh fragrant curry leaves slow-crisped with pure spices. Their medicinal volatile oils bring the unmistakable home-cooked kitchen aroma.',
    flavorNote: 'Herbaceous, nutty, and distinctly South Indian.',
    image: '/images/recipe_bisi_bele_bath.jpg',
  },
  {
    id: 'fenugreek',
    name: 'Golden Fenugreek Seeds',
    regionalName: 'ಮೆಂತ್ಯ (Menthya)',
    botanicalName: 'Trigonella foenum-graecum',
    role: 'Bitter-Sweet Nuance & Complexity',
    description: 'Slowly roasted to a precise golden hue so it releases sweet maple-like undertones rather than harsh bitterness, essential for authentic sambar and puliyogare.',
    flavorNote: 'Subtle pleasant bitterness, nutty, and savory.',
    image: '/images/recipe_puliyogare_rice.jpg',
  },
  {
    id: 'mustard',
    name: 'Small Brown Mustard Seeds',
    regionalName: 'ಸಾಸಿವೆ (Sasive)',
    botanicalName: 'Brassica juncea',
    role: 'Pungent Pop & Tempering Symphony',
    description: 'High-oil small mustard seeds that crackle vigorously in hot ghee, releasing an intense, nutty, pungent spark that crowns every South Indian dish.',
    flavorNote: 'Nutty when toasted, sharp and pungent when burst.',
    image: '/images/recipe_vegetable_sambar.jpg',
  },
];

export const CLIENT_REVIEWS: CustomerReview[] = [
  {
    id: 'rev-1',
    name: 'Lakshmi Narayanan',
    location: 'Bengaluru, Karnataka',
    rating: 5,
    date: '2 weeks ago',
    comment: 'The Rasam Powder brings back the taste of my grandmother’s kitchen in Mysuru. The aroma when it hits the hot tomato broth is absolutely wonderful. Pure nostalgia in every sip.',
    productPurchased: 'Authentic Rasam Powder (250g)',
    verified: true,
  },
  {
    id: 'rev-2',
    name: 'Sridhar Rao',
    location: 'Hyderabad, Telangana',
    rating: 5,
    date: '1 month ago',
    comment: 'The Puliyogare powder is so easy to prepare and tastes authentic just like temple prasadam. The balance of spice, sesame, and pepper is perfect. Ordered 3 more packs for family.',
    productPurchased: 'Traditional Puliyogare Powder (250g)',
    verified: true,
  },
  {
    id: 'rev-3',
    name: 'Meenakshi Sundaram',
    location: 'Chennai, Tamil Nadu',
    rating: 5,
    date: '3 weeks ago',
    comment: 'Finally a brand that doesn’t dump artificial food color or excess salt! The Sambar powder has that rich roasted lentil aroma and subtle sweetness. Highly recommend.',
    productPurchased: 'Home-Style Sambar Powder (500g)',
    verified: true,
  },
  {
    id: 'rev-4',
    name: 'Ananya Deshpande',
    location: 'Pune, Maharashtra',
    rating: 5,
    date: 'Just recently',
    comment: 'The Gunpowder podi with hot melted ghee and soft idlis made our Sunday breakfast unforgettable. The crunch of dal and roasted sesame is spot on.',
    productPurchased: 'Crispy Gunpowder / Idli Chutney Podi',
    verified: true,
  },
];

export const INSTAGRAM_POSTS = [
  {
    id: 'ig-1',
    caption: 'Freshly roasted Byadagi chillies and coriander seeds ready for stone pounding. 🌶️ #SVHomeProducts #TraditionalSpices',
    image: '/images/gallery_byadagi_chillies.jpg',
    likes: 342,
  },
  {
    id: 'ig-2',
    caption: 'A comforting pot of tomato pepper rasam on a breezy morning. Pure South Indian love. 🍲 #RasamLovers #HomeCooked',
    image: '/images/recipe_tomato_rasam.jpg',
    likes: 512,
  },
  {
    id: 'ig-3',
    caption: 'Temple-style Puliyogare mixed with crunchy peanuts and hot sesame oil tempering. 🍚 #AuthenticTaste #Puliyogare',
    image: '/images/recipe_puliyogare_rice.jpg',
    likes: 428,
  },
  {
    id: 'ig-4',
    caption: 'Piping hot fluffy idlis dipped in spicy gunpowder podi mixed with pure desi ghee. 🧈 #GheePodiIdli #BreakfastDiaries',
    image: '/images/recipe_chutney_pudi_tiffin.jpg',
    likes: 689,
  },
  {
    id: 'ig-5',
    caption: 'Carefully packing fresh small-batch spice jars for our patrons across India. 📦 #ArtisanalSpices #SmallBatch',
    image: '/images/gallery_sun_dried_spices.jpg',
    likes: 295,
  },
  {
    id: 'ig-6',
    caption: 'Fresh shade-dried curry leaves and stone ground spices ready for Karivepaku podi. 🍃 #CurryLeaves #TraditionalWellness',
    image: '/images/recipe_vegetable_sambar.jpg',
    likes: 476,
  },
];
