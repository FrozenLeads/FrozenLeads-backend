const User = require('../models/user');

exports.disconnectGmail = async (req, res) => {
  try {
    const userId = req.user._id;

    // Make sure user is found and googleTokens field is removed
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.googleTokens = undefined; // Remove the token object
    await user.save(); // Save the updated user

    res.json({ message: 'Gmail disconnected', user });
  } catch (err) {
    console.error('Disconnect error:', err);
    res.status(500).json({ error: 'Disconnect failed', details: err.message });
  }
};
