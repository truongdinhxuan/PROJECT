var express = require('express');
var router = express.Router();
var CategoryModel = require('../models/category');
var ProductModel = require('../models/product');
var CustomerModel = require('../models/customer');
var ProductModel = require('../models/product');
var BrandModel = require('../models/brand');
var OrderModel = require('../models/order');
var StatusModel = require('../models/status');
var ReportModel = require('../models/report');
var CartModel = require('../models/cart');

const fs = require("fs");
const path = require("path");
const PayOs = require('@payos/node');
// const { checkLoginSession } = require("../middlewares/auth");
/* GET home page. */
// router.get('/', async (req, res, next) {
//   res.render('index', { title: 'Hello World' });
// });
const imagesExtensions = /.(png|jpg|jpeg)$/i;
const getImageFiles = (directory) => {
  try {
    return fs
      .readdirSync(directory)
      .filter((file) => imagesExtensions.test(file));
  } catch (error) {
    console.error(error.message);
    return [];
  }
};
// INDEX & AUTH
router.get("/", async (req, res) => {
  try {
    // Fetch all products
    const products = await ProductModel.find().lean();
    
    const category = await CategoryModel.find().lean();
    
    const user = await CustomerModel.findOne({email: req.session.email}).lean();
    
    if (!user) {
      const productBigData = await Promise.all(products.map(async (product) => {
      
        const imagesDirectory = path.join(__dirname, product.photo);
        const imageFiles = getImageFiles(imagesDirectory);
        const imagesWithUrls = imageFiles.map((file) => `/uploads/${product._id}/${file}`);
  
        return {
          ...product,
          images: imagesWithUrls,
        };
      }));
        
      res.render('index', {
        layout: "/layout",
        category: category,
        product: productBigData,
      });
    } else {
      const productBigData = await Promise.all(products.map(async (product) => {
      
        const imagesDirectory = path.join(__dirname, product.photo);
        const imageFiles = getImageFiles(imagesDirectory);
        const imagesWithUrls = imageFiles.map((file) => `/uploads/${product._id}/${file}`);
  
        return {
          ...product,
          images: imagesWithUrls,
        };
      }));
        
      res.render('index', {
        layout: "/layout",
        category: category,
        product: productBigData,
        customer: user.name
      });
    }
    
  } catch (error) { 
    console.error('Error fetching products:', error);
    res.status(500).send('Internal Server Error');
  }
})
// ACCOUNT
router.get('/account', async (req, res) => {

  const customerEmail = req.session.email; // Get email from session
    // Fetch customer ID based on email
  const customer = await CustomerModel.findOne({ email: customerEmail }).lean();
  if (!customer) {
    // Handle the case where no customer is found (e.g., redirect to login)
    return res.redirect('/auth'); 
  }
  const customerId = customer.id;
  // Find orders associated with the customer
  const orders = await OrderModel.find({ buyerId: customerId }).lean();

  const statusIds = orders.map(order => order.statusId);
  const status = await StatusModel.find({ id: { $in: statusIds } }).lean();
  const statusMap = status.reduce((acc, status) => {
    acc[status.id] = status;
    return acc;
  }, {});
  console.log(status)
  const data = orders.map(order => ({
    ...order,
    status: statusMap[order.statusId] || null
  }));
  res.render('site/account', {
    layout: 'layout',
    data, // Send the array of orders to the view,
    customer: customer
  });
})
router.post('/update-profile/:id', async (req, res)=>{
  
  const customerId = req.params.id
  const name = req.body.name
  const email = req.body.email
  const password = req.body.password

  const customerData = {
    name: name,
    email: email,
    password: password
  }
  await CustomerModel.findByIdAndUpdate(customerId, customerData).lean()

  res.redirect('/account')
})
router.post('/update-status/:id', async (req, res) => {
  const orderId = req.params.id
  await OrderModel.findByIdAndUpdate(orderId, { statusId: 6 }, { new: true, lean: true });
  
  res.redirect('/account')
})
router.post('/send-report/:id', async (req, res) => {
  try {
    const title = req.body.title;
    const message = req.body.message;
    const orderId = req.params.id;
    // Find the order using the orderCode
    const order = await OrderModel.findById(orderId).lean();
    if (!order) {
      return res.status(404).send('Order not found');
    }
    // Prepare report data
    const reportData = {
      id: await ReportModel.countDocuments() + 1,
      orderId: order.orderCode,  // Assuming orderId refers to the ObjectId of the order document
      title: title,
      message: message
    };

    // Create and save the new report
    const newReport = new ReportModel(reportData);
    await newReport.save();

    await OrderModel.findByIdAndUpdate(orderId, { statusId: 7 });
    // Redirect with a success message
    res.redirect('/account');
  } catch (error) {
    console.error('Error sending report:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

// PRODUCT
router.get('/product',async(req,res) =>{
  try {
    // Fetch all products
    const products = await ProductModel.find().lean();
    
    const category = await CategoryModel.find().lean();

    const user = await CustomerModel.findOne({email: req.session.email}).lean();

    const productBigData = await Promise.all(products.map(async (product) => {
      
      const imagesDirectory = path.join(__dirname, product.photo);
      const imageFiles = getImageFiles(imagesDirectory);
      const imagesWithUrls = imageFiles.map((file) => `/uploads/${product._id}/${file}`);

      return {
        ...product,
        images: imagesWithUrls,
      };
    }));
      
    res.render('product', {
      layout: "/layout",
      category: category,
      product: productBigData,
      customer: user,
    }); 
  } catch (error) { 
    console.error('Error fetching products:', error);
    res.status(500).send('Internal Server Error');
  }
})
router.get('/product/detail/:urlRewriteName', async (req, res) => {
  const urlRewriteName = req.params.urlRewriteName;

  try {
      // 1. Fetch the specific product
      const product = await ProductModel.findOne({ urlRewriteName }).lean(); // Changed to findOne

      // 2. Handle Image Processing ONLY for the found product
      const imagesDirectory = path.join(__dirname, product.photo);
      const imageFiles = getImageFiles(imagesDirectory);
      const imagesWithUrls = imageFiles.map((file) => `/uploads/${product._id}/${file}`);

      // 3. Combine Product with Images
      const productWithImages = {
          ...product,
          images: imagesWithUrls,
      };

      // Fetch categories and user (if needed)
      const category = await CategoryModel.findOne({id: product.categoryId}).lean();
      const brand = await BrandModel.findOne({id: product.brandId}).lean();
      const user = await CustomerModel.findOne({ email: req.session.email }).lean();

      // 4. Render the View
      res.render('product/detail', {
          layout: "layout",
          category: category,
          brand: brand,
          product: productWithImages, // Pass the single product with images
          customer: user,
      });
  } catch (error) {
      console.error('Error fetching product details:', error);
      res.status(500).send('Internal Server Error');
  }
});

// CART
router.get('/cart', async (req, res) => {
  const user = await CustomerModel.findOne({email: req.session.email}).lean();
  if (!req.session.cart) {
    return res.render('site/cart', { products: null });
  }
  const cart = new CartModel(req.session.cart);
  // Get product data with image URLs
  const productsWithImages = await Promise.all(cart.generateArray().map(async (item) => {
    const product = await ProductModel.findById(item.item._id).lean(); // Assuming you need product data from the database
    const imagesDirectory = path.join(__dirname, product.photo);
    const imageFiles = getImageFiles(imagesDirectory);
    const imagesWithUrls = imageFiles.map((file) => `/uploads/${product._id}/${file}`);
    
    return {
      ...item,
      item: {
        ...item.item,
        images: imagesWithUrls
      }
    };
  }));
  res.render('site/cart', {
    layout: 'layout',
    totalPrice: cart.totalPrice,
    totalQty: cart.totalQty,
    customer: user.name,
    products: productsWithImages,
  });
});

router.get('/add-cart/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const cart = new CartModel(req.session.cart ? req.session.cart : {});
    const product = await ProductModel.findById(productId);
    if (!product) {
      return res.redirect('/');
    }

    cart.add(product, product.id);
    req.session.cart = cart;
    console.log(req.session.cart);
    res.redirect('/product');
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

router.get('/cart/reduce/:id', async (req, res) =>{
  const productId = req.params.id;
  const product = await ProductModel.findById(productId);
  const cart = new CartModel(req.session.cart ? req.session.cart : {});
  cart.reduceByOne(product.id);
  req.session.cart = cart;
  res.redirect('/cart');
});

router.get('/cart/plus/:id', async (req, res) =>{
  const productId = req.params.id;
  const product = await ProductModel.findById(productId);
  const cart = new CartModel(req.session.cart ? req.session.cart : {});
  cart.plusByOne(product.id);
  req.session.cart = cart;
  res.redirect('/cart');
});

router.get('/cart/remove/:id', async (req, res) =>{
  const productId = req.params.id;
  const product = await ProductModel.findById(productId);
  const cart = new CartModel(req.session.cart ? req.session.cart : {});
  cart.removeItem(product.id);
  req.session.cart = cart;
  res.redirect('/cart');
});

// CHECKOUT
function generateOrderCode() {
  return Math.floor(Math.random() * 99999); // Generate a random 6-digit number
}

router.get('/checkout/success', async (req, res) => {
  const pendingOrder = req.session.pendingOrder;

  if (pendingOrder) { // Check if pendingOrder exists
      
          // Update order status
          pendingOrder.status = 2;

          // Save the order to the database
          const newOrder = new OrderModel(pendingOrder);
          await newOrder.save();
  } else {
    // Optionally redirect to a different page or handle the situation gracefully
    return res.redirect('/account'); // Redirect to an error page, for example
  }

  // Clear the session data
  delete req.session.pendingOrder;
  delete req.session.items
  // Redirect to a success page
  res.redirect('/checkout/success');
});

router.get('/checkout/cancel' , async (req,res) => {

  res.render('checkout/cancel',{
    layout: "/layout"
  })
});

router.get('/checkout', async(req,res)=>{
  const cart = new CartModel(req.session.cart);
  const customer = await CustomerModel.findOne({email: req.session.email}).lean()
  res.render('checkout',{
    layout: 'layout',
    customer: customer,
    totalPrice: cart.totalPrice,
    totalQty: cart.totalQty,
  })
});

router.post('/checkout',async (req, res) => {
  const customerEmail = req.session.email;

  const customer = await CustomerModel.findOne({ email: customerEmail }).lean();
    
    if (!customer) {
      // Handle the case where no customer is found with the email (e.g., redirect to login)
      return res.redirect('/login'); // Or other error handling
    }
  const customerId = customer.id; 

  const cart = new CartModel(req.session.cart)
  const name = req.body.name
  const country = req.body.country
  const address = req.body.address
  const phone = req.body.phone
  const email = req.body.email
  const note = req.body.note
  const paymentMethod = req.body.paymentMethod
  
  const orderData = {
    orderCode: generateOrderCode(),
    buyerId: customerId,
    buyerName: name,
    buyerEmail: email,
    buyerPhone: phone,
    buyerCountry: country,
    buyerAddress: address,
    buyerNote: note,
    amount: cart.totalPrice,
    paymentMethod: paymentMethod,
    items: cart.items,
    statusId: 1,
    note: ""
  }

  if (paymentMethod === 'bank') {
  const order = {
      orderCode: orderData.orderCode,
      amount: cart.totalPrice,
      description: "ShopBadmintonVn",
      returnUrl: `${DOMAIN_URL}/checkout/success`,
      cancelUrl: `${DOMAIN_URL}/checkout/cancel`,  
  }
  const paymentLink = await payos.createPaymentLink(order);
  req.session.pendingOrder = orderData;
  console.log(req.session.pendingOrder)
  res.redirect(303, paymentLink.checkoutUrl);
  } else if (paymentMethod === 'cod') {
    const newOrder = new OrderModel(orderData);
    await newOrder.save();
    res.redirect('/account')
  } else {
    res.render('checkout',{
      layout: 'layout',
      message: "Choose one method first"
    })
  }
});
const payos = new PayOs(
  "c57285fa-6aab-486d-9c15-503c13f158a8",
  "364eea32-f6bc-4b81-884b-66c3eb436424",
  "326f33d24c9beb21bcc00ed032a77118820849f0a64bf694762d12ca017a7dc4"
);
// Local
// const DOMAIN_URL='http://localhost:3000'
// Server
const DOMAIN_URL='https://shopbadmintonvn.onrender.com'
module.exports = router;
