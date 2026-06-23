// backend/models/Habit.js

const mongoose = require('mongoose');

// ─── Schema Definition ─────────────────────────────────────────────────────
// Schema = blueprint. Defines what fields a Habit document has.
// Like designing a form before printing it.

const habitSchema = new mongoose.Schema(
  {
    name: {
      type: String,       // must be text
      required: [true, 'Habit name is required'],
      // [true, 'message'] = validation + custom error message
      trim: true,         // removes accidental spaces: "  Run  " → "Run"
      maxlength: [100, 'Name cannot exceed 100 characters']
    },

    description: {
      type: String,
      trim: true,
      default: '',        // optional field — empty string if not provided
      maxlength: [300, 'Description cannot exceed 300 characters']
    },

    completedDates: {
      type: [Date],       // Array of Date objects
      default: []         // starts as empty array
      // Every time user marks habit done, we push today's date here
      // Example: [2024-01-01, 2024-01-02, 2024-01-04]
    },

    currentStreak: {
      type: Number,
      default: 0          // starts at 0, calculated when habit completed
    },

    longestStreak: {
      type: Number,
      default: 0          // tracks all-time best streak
    },

    color: {
      type: String,
      default: '#4CAF50'  // green — each habit gets a display color
    },

    isActive: {
      type: Boolean,
      default: true       // soft delete — hide instead of destroy
    }
  },
  {
    timestamps: true
    // Mongoose auto-adds two fields:
    // createdAt — when habit was created
    // updatedAt — when habit was last modified
    // Very useful for sorting and debugging
  }
);

// ─── Virtual Field ─────────────────────────────────────────────────────────
// Virtual = computed property. NOT stored in DB. Calculated on the fly.

habitSchema.virtual('isCompletedToday').get(function () {
  // Must use regular function (not arrow) — needs 'this' keyword
  // 'this' refers to the current habit document

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Set time to midnight so we compare DATES not timestamps
  // Without this: 2024-01-01 09:00 ≠ 2024-01-01 17:00 (wrong!)
  // With this:    2024-01-01 00:00 = 2024-01-01 00:00 (correct!)

  return this.completedDates.some(date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
    // .getTime() converts Date to milliseconds number for easy comparison
  });
});

// Make virtuals appear when converting to JSON
// (needed when we send habit data to React)
habitSchema.set('toJSON', { virtuals: true });
habitSchema.set('toObject', { virtuals: true });

// ─── Create Model ──────────────────────────────────────────────────────────
// Model = class built from schema. Used to create/read/update/delete docs.
// First arg 'Habit' → MongoDB creates collection named 'habits' (auto lowercase + plural)

const Habit = mongoose.model('Habit', habitSchema);

module.exports = Habit;