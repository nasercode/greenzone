const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL || 'sqlite:./db.sqlite', { logging:false });

const Product = sequelize.define('Product', {
  name: { type: DataTypes.STRING, allowNull:false },
  description: { type: DataTypes.TEXT },
  price_cents: { type: DataTypes.INTEGER, allowNull:false },
  image_url: { type: DataTypes.STRING },
  stock: { type: DataTypes.INTEGER, defaultValue:100 }
});

const Order = sequelize.define('Order', {
  stripeSessionId: DataTypes.STRING,
  customerEmail: DataTypes.STRING,
  amount_cents: DataTypes.INTEGER,
  status: DataTypes.STRING,
  shipped: { type: DataTypes.BOOLEAN, defaultValue:false }
});

const OrderItem = sequelize.define('OrderItem', {
  name: DataTypes.STRING,
  price_cents: DataTypes.INTEGER,
  quantity: DataTypes.INTEGER
});

Product.hasMany(OrderItem);
OrderItem.belongsTo(Product);
Order.hasMany(OrderItem);
OrderItem.belongsTo(Order);

module.exports = { sequelize, Product, Order, OrderItem };
