// backend/routes/habitRoutes.js

const express = require('express');
const router = express.Router();
// Router = mini Express app, handles a GROUP of related routes
// Keeps server.js clean — all habit routes live here

const Habit = require('../models/habit');
// Import Habit model — our gateway to MongoDB habits collection

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTION — Streak Calculator
// ═══════════════════════════════════════════════════════════════
// Lives here because all completion logic needs it
/*
const calculateStreak = (completedDates) => {
  if (!completedDates || completedDates.length === 0) return 0;
  // No dates = no streak

  // Step 1: Convert all dates to midnight timestamps, sort newest first
  const dates = completedDates
    .map(date => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);   // strip time, keep date only
      return d.getTime();         // convert to number (ms) for easy compare
    })
    .sort((a, b) => b - a);      // sort descending: [today, yesterday, ...]

  // Step 2: Remove duplicate dates (if user marked done twice same day)
  const uniqueDates = [...new Set(dates)];
  // Set automatically removes duplicates
  // Spread [...] converts Set back to array

  // Step 3: Count consecutive days from today or yesterday
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;  // milliseconds in one day

  let streak = 0;

  for (let i = 0; i < uniqueDates.length; i++) {
    const expectedDate = todayMs - (i * oneDayMs);
    // i=0 → today, i=1 → yesterday, i=2 → day before...

    if (uniqueDates[i] === expectedDate) {
      streak++;
      // Date matches expected → streak continues
    } else {
      break;
      // Gap found → streak broken, stop counting
    }
  }

  return streak;
}; */
// backend/routes/habitRoutes.js
// Replace ONLY the calculateStreak function at top of file

const calculateStreak = (completedDates) => {
  if (!completedDates || completedDates.length === 0) return 0;

  // Normalize all dates to midnight, deduplicate, sort newest first
  const uniqueDates = [
    ...new Set(
      completedDates.map(date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    )
  ].sort((a, b) => b - a);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs    = today.getTime();
  const oneDayMs   = 24 * 60 * 60 * 1000;
  const yesterdayMs = todayMs - oneDayMs;

  // Grace period: if most recent completion isn't today OR yesterday
  // streak is broken — return 0 immediately
  if (uniqueDates[0] !== todayMs && uniqueDates[0] !== yesterdayMs) {
    return 0;
    // Example: last done 3 days ago → streak = 0
    // Streak must be continuous to today or yesterday
  }

  // Count backwards from most recent date
  let streak = 0;
  for (let i = 0; i < uniqueDates.length; i++) {
    const expectedDate = uniqueDates[0] - (i * oneDayMs);
    // Start from most recent (today or yesterday), go back one day at a time

    if (uniqueDates[i] === expectedDate) {
      streak++;
    } else {
      break; // gap found
    }
  }

  return streak;
};

// ═══════════════════════════════════════════════════════════════
// ROUTE 1 — GET /api/habits
// Fetch all active habits
// ═══════════════════════════════════════════════════════════════

router.get('/', async (req, res) => {
  try {
    const habits = await Habit.find({ isActive: true })
      .sort({ createdAt: -1 });
    // Habit.find() = SELECT * FROM habits WHERE isActive = true
    // { isActive: true } = filter object (only active habits)
    // .sort({ createdAt: -1 }) = newest first (-1 = descending)
    // await = wait for MongoDB to respond before continuing

    res.json({
      success: true,
      count: habits.length,
      data: habits
      // habits array auto-includes virtual 'isCompletedToday'
      // because we set toJSON: { virtuals: true } in schema
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error fetching habits',
      error: error.message
    });
    // status(500) = Internal Server Error
    // Always send error details in dev — helps debugging
  }
});

// ═══════════════════════════════════════════════════════════════
// ROUTE 2 — POST /api/habits
// Create a new habit
// ═══════════════════════════════════════════════════════════════

router.post('/', async (req, res) => {
  try {
    const { name, description, color } = req.body;
    // req.body = JSON data sent from React frontend
    // Destructure only fields we expect (security: ignore extra fields)

    // Manual validation before hitting DB
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Habit name is required'
      });
      // status(400) = Bad Request (client sent wrong data)
      // return early — stop function, don't continue to DB
    }

    const habit = new Habit({
      name: name.trim(),
      description: description ? description.trim() : '',
      color: color || '#4CAF50'
      // If frontend sends color use it, else default green
    });
    // new Habit() creates document IN MEMORY only
    // Nothing saved to DB yet

    const savedHabit = await habit.save();
    // .save() = INSERT INTO habits ← actually writes to MongoDB
    // Returns the saved document with _id, timestamps etc.

    res.status(201).json({
      success: true,
      data: savedHabit
    });
    // status(201) = Created (not 200 — 201 specifically means "resource created")

  } catch (error) {
    if (error.name === 'ValidationError') {
      // Mongoose schema validation failed (e.g. maxlength exceeded)
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error creating habit',
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROUTE 3 — PUT /api/habits/:id/complete
// Toggle today's completion for a habit
// ═══════════════════════════════════════════════════════════════

router.put('/:id/complete', async (req, res) => {
  // :id = URL parameter (dynamic segment)
  // GET /api/habits/64f1a2b3.../complete → req.params.id = "64f1a2b3..."

  try {
    const habit = await Habit.findById(req.params.id);
    // findById = SELECT * FROM habits WHERE _id = req.params.id

    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
      // status(404) = Not Found
    }

    // Check if already completed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alreadyCompleted = habit.completedDates.some(date => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });

    if (alreadyCompleted) {
      // Toggle OFF — remove today's date
      habit.completedDates = habit.completedDates.filter(date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() !== today.getTime();
        // Keep all dates EXCEPT today
      });
    } else {
      // Toggle ON — add today's date
      habit.completedDates.push(today);
      // push() adds to the array
    }

    // Recalculate streaks based on updated completedDates
    habit.currentStreak = calculateStreak(habit.completedDates);

    // Update longestStreak if current beats it
    if (habit.currentStreak > habit.longestStreak) {
      habit.longestStreak = habit.currentStreak;
    }

    const updatedHabit = await habit.save();
    // Save all changes back to MongoDB

    res.json({
      success: true,
      data: updatedHabit,
      isCompletedToday: !alreadyCompleted
      // Tell frontend the NEW state (toggled)
    });

  } catch (error) {
    if (error.name === 'CastError') {
      // CastError = invalid MongoDB ID format sent in URL
      return res.status(400).json({
        success: false,
        message: 'Invalid habit ID format'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error updating habit',
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROUTE 4 — DELETE /api/habits/:id
// Soft delete — sets isActive to false (data preserved)
// ═══════════════════════════════════════════════════════════════

router.delete('/:id', async (req, res) => {
  try {
    const habit = await Habit.findById(req.params.id);

    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    habit.isActive = false;
    // Soft delete: mark inactive instead of destroying
    // Why? Recovering deleted data from DB is hard.
    // isActive: false hides it from GET but keeps history.
    // For real delete use: await Habit.findByIdAndDelete(req.params.id)

    await habit.save();

    res.json({
      success: true,
      message: 'Habit deleted successfully'
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid habit ID format'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error deleting habit',
      error: error.message
    });
  }
});

// GET /api/habits/stats
// Aggregated dashboard numbers — computed server-side

router.get('/stats', async (req, res) => {
  try {
    const habits = await Habit.find({ isActive: true });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count habits completed today
    const completedToday = habits.filter(habit =>
      habit.completedDates.some(date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      })
    ).length;

    // Find single longest streak across ALL habits
    const longestStreak = habits.reduce((max, h) =>
      h.longestStreak > max ? h.longestStreak : max, 0
    );

    // 7-day completion rate: how many habits completed each day this week
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      // setDate handles month rollover automatically

      const dayMs = day.getTime();
      const label = day.toLocaleDateString('en-US', { weekday: 'short' });
      // 'Mon', 'Tue' etc.

      const count = habits.filter(habit =>
        habit.completedDates.some(date => {
          const d = new Date(date);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === dayMs;
        })
      ).length;

      weekData.push({ label, count, total: habits.length });
    }

    res.json({
      success: true,
      data: {
        totalHabits: habits.length,
        completedToday,
        longestStreak,
        completionRate: habits.length > 0
          ? Math.round((completedToday / habits.length) * 100)
          : 0,
        weekData
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
module.exports = router;
// Export router so server.js can mount it