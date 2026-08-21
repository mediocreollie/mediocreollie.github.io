"""The one product and three stores this tracker is allowed to observe."""

PRODUCT = {
    "name": "Cocobella Coconut Water Straight Up 1L",
    "brand": "Cocobella",
    "size": "1L",
}

COLES = {
    "retailer": "Coles",
    "store": "Rundle Place",
    "storeId": "4964",
    "productId": "1251527",
    "productUrl": "https://www.coles.com.au/product/cocobella-coconut-water-straight-up-1l-1251527",
    "storeUrl": "https://www.coles.com.au/find-stores/coles/sa/adelaide-4964",
    "graphqlUrl": "https://www.coles.com.au/api/graphql",
}

WOOLWORTHS = {
    "retailer": "Woolworths",
    "store": "Rundle Mall",
    "storeId": "5317",
    "productId": "724514",
    "productUrl": "https://www.woolworths.com.au/shop/productdetails/724514/cocobella-coconut-water-straight-up",
    "storeUrl": "https://www.woolworths.com.au/shop/storelocator/sa-adelaide-5317",
    "catalogueSalesUrl": "https://webservice.salefinder.com.au/index.php/api/sales/retailer/?id=126&apikey=w00lw0rth5A48E69B9C93E236B&format=json",
    "catalogueRegionsUrl": "https://webservice.salefinder.com.au/index.php/api/regions/search/?apikey=w00lw0rth5A48E69B9C93E236B&format=json&location=5000",
    "catalogueEmbedUrl": "https://embed.salefinder.com.au/126/",
}

FOODLAND = {
    "retailer": "Foodland",
    "store": "Henley Square",
    "storeId": None,
    "address": "348-354 Seaview Road, Henley Beach SA",
    "specialsUrl": "https://henleysquarefoodland.com.au/specials/",
    "catalogueUrl": "https://www.foodlandsa.com.au/catalogue/",
}
