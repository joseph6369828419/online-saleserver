// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());





const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

// Endpoint to send a message
app.post('/send-message', (req, res) => {
  const { messageBody, toNumber } = req.body;

  client.messages
    .create({
      body: messageBody,
      to: toNumber, // Text your number
      from: '+13344535329', // From a valid Twilio number
    })
    .then((message) => {
      console.log(message.sid);
      res.status(200).send('Message sent successfully!');
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send('Failed to send message');
    });
});
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});
const UserSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  username: { type: String, unique: true },
  password: String,
  address: [
    {
      address: String,
      city: String,
      state: String,
      zip: Number,
      country: String,
    },
  ],
  cart: [
    {
      id: Number,
      name: String,
      price: Number,
      image: String,
      quantity: Number,
    },
  ],
  orders: [
    {
      items: [
        {
          name: { type: String, required: true },
          price: { type: Number, required: true },
          image: { type: String, required: true },
          quantity: { type: Number, required: true, min: 1 },
        },
      ],
      total: { type: Number, required: true },
      date: { type: Date, default: Date.now },
    },
  ],
});

const User = mongoose.model('User', UserSchema);











app.post('/api/orders', async (req, res) => {
  const { username, order } = req.body;

  if (!username || !order) {
    return res.status(400).json({ message: 'Username and order details are required.' });
  }

  try {
    // Find the user by username
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Add the new order to the user's orders array
    user.orders.push(order);

    // Optionally, clear the cart after placing the order
    user.cart = [];

    // Save the updated user document
    await user.save();

    res.status(200).json({ message: 'Order placed successfully.', order: order });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});




app.get('/api/orders', async (req, res) => {
  const { username } = req.query;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ orders: user.orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Error fetching orders', error });
  }
});


// DELETE route to cancel an order
app.delete('/api/delete-orders/:username/:orderId', async (req, res) => {
  const { username, orderId } = req.params;

  try {
    // Validate orderId as a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID format.' });
    }

    // Find the user by username and pull the order with the specified orderId
    const user = await User.findOneAndUpdate(
      { username },
      { $pull: { orders: { _id: orderId } } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if the order was actually removed
    const removedOrder = user.orders.id(orderId);
    if (removedOrder) {
      // If the order still exists, it wasn't removed
      return res.status(500).json({ message: 'Failed to cancel the order.' });
    }

    res.status(200).json({ message: 'Order canceled successfully.' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});













app.post('/api/purchase', async (req, res) => {
  const { username, addressData } = req.body;
  
  try {
    // Find the user by username
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add or update address in user profile
    user.address = [addressData]; // Assuming a single address for now

    // Save the updated user document
    await user.save();

    return res.status(200).json({ message: 'Purchase confirmed', user });
  } catch (error) {
    return res.status(500).json({ message: 'Error processing purchase', error });
  }
});




app.get('/api/get-addresses/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    res.json(user ? user.address : []);
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// Add address for a user
app.post('/api/add-address/:username', async (req, res) => {
  const { username } = req.params;
  const newAddress = req.body;

  try {
    await User.updateOne({ username }, { $push: { address: newAddress } });
    res.status(201).send('Address added');
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// Update address for a user
app.put('/api/update-address/:username', async (req, res) => {
  const { username } = req.params;
  const updatedAddress = req.body;

  try {
    await User.updateOne(
      { username, 'address._id': updatedAddress._id },
      { $set: { 'address.$': updatedAddress } }
    );
    res.send('Address updated');
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// Delete address for a user
app.delete('/api/delete-address/:username/:index', async (req, res) => {
  const { username, index } = req.params;

  try {
    await User.updateOne(
      { username },
      { $pull: { address: { _id: mongoose.Types.ObjectId(index) } } }
    );
    res.send('Address deleted');
  } catch (error) {
    res.status(500).send('Server Error');
  }
});




















// Register Route
app.post('/api/register', async (req, res) => {
  const { name, phone, email, username, password } = req.body;

  const user = new User({ name, phone, email, username, password });
  
  try {
    await user.save();
    res.status(201).send({ message: 'User registered successfully' });
  } catch (error) {
    res.status(400).send({ message: 'Registration failed' });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user || user.password !== password) {
    return res.status(400).send({ message: 'Invalid credentials' });
  }

  res.send({ message: 'Login successful', username: user.username, cart: user.cart });
});


app.put('/api/forgot-password', async (req, res) => {
  const { username, newPassword } = req.body;

  try {
    // Find user by username
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user's password (No encryption for now as per your request)
    user.password = newPassword; // Use a hash function in production
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset password', error: error.message });
  }
});










app.post('/api/add-to-cart', async (req, res) => {
  const { username, product } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add product to cart
    user.cart.push(product);
    await user.save();

    res.status(200).json({ message: 'Product added to cart successfully' });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get user's cart endpoint
app.get('/api/cart/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ cart: user.cart });
  } catch (error) {
    console.error('Error retrieving cart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});





app.delete('/api/remove-from-cart/:username/:productId', async (req, res) => {
  const { username, productId } = req.params;

  try {
    // Remove the product from the cart using $pull
    const user = await User.findOneAndUpdate(
      { username },
      { $pull: { cart: { _id: productId } } }, // Pull the product with matching _id from the cart
      { new: true } // Return the updated document
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Product removed from cart successfully' });
  } catch (error) {
    console.error('Error removing product:', error);
    res.status(500).json({ message: 'Failed to remove product from cart' });
  }
});





// Get User Cart Route
app.post('/api/cart/view', async (req, res) => {
  const { username } = req.body;

  try {
    const user = await User.findOne({ username });
    res.send({ cart: user.cart });
  } catch (error) {
    res.status(400).send({ message: 'Failed to retrieve cart' });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
