const mongoose = require('mongoose');
const slugify = require('slugify');

const blogPostSchema = new mongoose.Schema(
  {
    adminId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    title: { type: String, required: true },
    slug: { type: String, unique: true },
    content: { type: String },
    featuredImagePath: { type: String },
    seoTitle: { type: String },
    seoDescription: { type: String },
    category: { type: String },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

blogPostSchema.pre('save', function (next) {
  if (this.isModified('title') || !this.slug) {
    this.slug = slugify(this.title, { lower: true, strict: true }) + '-' + Date.now();
  }
  if (this.published && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('BlogPost', blogPostSchema);
