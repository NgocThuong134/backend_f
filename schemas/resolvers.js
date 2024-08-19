const { AuthenticationError } = require("apollo-server-express");
const { User, Product, Category, Order } = require("../models");
const { signToken } = require("../utils/auth");
const stripe = require("stripe")("sk_test_4eC39HqLyjWDarjtT1zdp7dc");

const resolvers = {
  Query: {
    categories: async () => {
      return await Category.find();
    },
    product: async (parent, { _id }) => {
      return await Product.findById(_id).populate("category");
    },
    products: async (parent, { category, name }) => {
      const params = {};

      if (category) {
        params.category = category;
      }

      if (name) {
        params.name = {
          $regex: name,
        };
      }

      return await Product.find(params).populate("category");
    },
    // product: async (parent, { _id }) => {
    //   return await Product.findById(_id).populate("category");
    // },
    user: async (parent, args, context) => {
      if (context.user) {
        const user = await User.findById(context.user._id).populate({
          path: "orders.products",
          populate: "category",
        });

        user.orders.sort((a, b) => b.purchaseDate - a.purchaseDate);

        return user;
      }

      throw new AuthenticationError("Not logged in");
    },
    order: async (parent, { _id }, context) => {
      if (context.user) {
        const user = await User.findById(context.user._id).populate({
          path: "orders.products",
          populate: "category",
        });

        return user.orders.id(_id);
      }

      throw new AuthenticationError("Not logged in");
    },
    checkout: async (parent, args, context) => {
      const products = await Product.find({
        _id: { $in: args.products },
      }).populate("category");

      const line_items = [];

      for (let i = 0; i < products.length; i++) {
        try {
          const product = await stripe.products.create({
            name: products[i].name,
            description: products[i].description,
            images: [`http://localhost:3000/images/${products[i].image}`], // Thay thế bằng URL thật sự
          });

          const price = await stripe.prices.create({
            product: product.id,
            unit_amount: products[i].price * 100,
            currency: "usd",
          });
          // Thêm price id vào line items
          line_items.push({ price: price.id, quantity: 1 });
        } catch (error) {
          console.error("Error creating product or price in Stripe:", error);
        }
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items,
        mode: "payment",
        success_url: `http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}`, // Thay thế bằng URL thật sự
        cancel_url: `http://localhost:3000/`, // Thay thế bằng URL thật sự
      });

      return { session: session.id };
    },
  },
  Mutation: {
    async addProduct(_, { name, description, image, quantity, price, category }) {
      const newProduct = new Product({
        name,
        description,
        image,
        quantity,
        price,
        category,
      });

      const savedProduct = await newProduct.save();
      return savedProduct.populate('category'); // Populate category if needed
    },

    async updateProductDetails(_, { _id, name, description, image, quantity, price, category }) {
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (image !== undefined) updates.image = image;
      if (quantity !== undefined) updates.quantity = quantity;
      if (price !== undefined) updates.price = price;
      if (category !== undefined) updates.category = category;

      const updatedProduct = await Product.findByIdAndUpdate(_id, updates, { new: true });
      return updatedProduct.populate('category'); // Populate category
    },

    async deleteProduct(_, { _id }) {
      const deletedProduct = await Product.findByIdAndDelete(_id);
      return deletedProduct; // Return the deleted product
    },
    addUser: async (parent, args) => {
      const user = await User.create(args);
      const token = signToken(user);

      return { token, user };
    },
    addOrder: async (parent, { products }, context) => {
      console.log("addOrder called");
      if (context.user) {
        const order = await Order.create({ products });
        console.log("Order: ", order);
        await User.findByIdAndUpdate(context.user._id, { $push: { orders: order } });
        console.log("ADDED");
        return order;
      }

      throw new AuthenticationError('Not logged in');
    }
    ,
    updateUser: async (parent, args, context) => {
      if (context.user) {
        return await User.findByIdAndUpdate(context.user._id, args, {
          new: true,
        });
      }

      throw new AuthenticationError("Not logged in");
    },
    updateProduct: async (parent, { _id, quantity }) => {
      const decrement = Math.abs(quantity) * -1;

      return await Product.findByIdAndUpdate(
        _id,
        { $inc: { quantity: decrement } },
        { new: true }
      );
    },
    login: async (parent, { email, password }) => {
      const user = await User.findOne({ email });

      if (!user) {
        throw new AuthenticationError("Incorrect credentials");
      }

      const correctPw = await user.isCorrectPassword(password);

      if (!correctPw) {
        throw new AuthenticationError("Incorrect credentials");
      }

      const token = signToken(user);

      return { token, user };
    },
  },
};

module.exports = resolvers;
