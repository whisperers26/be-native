// Where a window goes next to what the user is looking at. Arithmetic only, in physical pixels.

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

impl Rect {
    fn right(&self) -> i32 {
        self.x + self.width
    }

    fn bottom(&self) -> i32 {
        self.y + self.height
    }
}

// Keep a span of `length` that starts at `start` between `low` and `high`. A span longer than the
// room starts at `low`.
fn keep_inside(start: i32, length: i32, low: i32, high: i32) -> i32 {
    start.min(high - length).max(low)
}

fn overlap(a: Rect, b: Rect) -> i64 {
    let width = a.right().min(b.right()) - a.x.max(b.x);
    let height = a.bottom().min(b.bottom()) - a.y.max(b.y);
    if width <= 0 || height <= 0 {
        return 0;
    }
    width as i64 * height as i64
}

// The top left corner nearest to (`x`, `y`) that keeps a window of `width` x `height` inside `bounds`
pub fn inside(x: i32, y: i32, width: i32, height: i32, bounds: Rect) -> (i32, i32) {
    (
        keep_inside(x, width, bounds.x, bounds.right()),
        keep_inside(y, height, bounds.y, bounds.bottom()),
    )
}

// The rectangle part of the way from `from` to `to`: `from` at 0, `to` at 1. The way is fast at
// first and slows down towards `to`.
pub fn between(from: Rect, to: Rect, part: f64) -> Rect {
    let eased = 1.0 - (1.0 - part.clamp(0.0, 1.0)).powi(3);
    let mix = |a: i32, b: i32| a + ((b - a) as f64 * eased).round() as i32;
    Rect {
        x: mix(from.x, to.x),
        y: mix(from.y, to.y),
        width: mix(from.width, to.width),
        height: mix(from.height, to.height),
    }
}

// The top left corner for a window of `width` x `height` beside `anchor`, inside `bounds`.
//
// The window goes right of the anchor, else left, below or above it: the first side with room for
// it, `gap` away. If no side has room, it goes where it covers the least of the anchor, and if it
// would lie within the anchor wherever it went, over the middle of it.
pub fn beside(anchor: Rect, width: i32, height: i32, bounds: Rect, gap: i32) -> (i32, i32) {
    let inside = |(x, y): (i32, i32)| {
        (
            keep_inside(x, width, bounds.x, bounds.right()),
            keep_inside(y, height, bounds.y, bounds.bottom()),
        )
    };
    let right = (anchor.right() + gap, anchor.y);
    let left = (anchor.x - gap - width, anchor.y);
    let below = (anchor.x, anchor.bottom() + gap);
    let above = (anchor.x, anchor.y - gap - height);
    let sides = [
        (right, right.0 + width <= bounds.right()),
        (left, left.0 >= bounds.x),
        (below, below.1 + height <= bounds.bottom()),
        (above, above.1 >= bounds.y),
    ];

    if let Some((corner, _)) = sides.iter().find(|(_, fits)| *fits) {
        return inside(*corner);
    }

    let covered = |(x, y): (i32, i32)| {
        overlap(
            anchor,
            Rect {
                x,
                y,
                width,
                height,
            },
        )
    };
    let mut best = inside(right);
    for (corner, _) in &sides[1..] {
        let corner = inside(*corner);
        if covered(corner) < covered(best) {
            best = corner;
        }
    }
    if covered(best) >= width as i64 * height as i64 {
        return inside((
            anchor.x + (anchor.width - width) / 2,
            anchor.y + (anchor.height - height) / 2,
        ));
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;

    const SCREEN: Rect = Rect {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
    };

    fn rect(x: i32, y: i32, width: i32, height: i32) -> Rect {
        Rect {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn a_window_inside_the_screen_stays_where_it_is() {
        assert_eq!(inside(100, 200, 350, 420, SCREEN), (100, 200));
    }

    #[test]
    fn a_window_past_the_edges_moves_back_inside() {
        assert_eq!(inside(1700, 900, 350, 420, SCREEN), (1570, 660));
    }

    #[test]
    fn the_way_between_two_rectangles_starts_at_one_and_ends_at_the_other() {
        let from = rect(100, 200, 420, 240);
        let to = rect(40, 260, 660, 450);
        assert_eq!(between(from, to, 0.0), from);
        assert_eq!(between(from, to, 1.0), to);
        assert_eq!(between(from, to, 7.0), to);
    }

    #[test]
    fn the_way_between_two_rectangles_slows_down() {
        let half = between(rect(0, 0, 400, 200), rect(0, 0, 800, 200), 0.5);
        assert_eq!(half, rect(0, 0, 750, 200));
    }

    #[test]
    fn goes_right_of_the_anchor_when_there_is_room() {
        let corner = beside(rect(100, 200, 300, 100), 350, 420, SCREEN, 8);
        assert_eq!(corner, (408, 200));
    }

    #[test]
    fn goes_left_when_the_right_side_has_no_room() {
        let corner = beside(rect(1500, 200, 300, 100), 350, 420, SCREEN, 8);
        assert_eq!(corner, (1142, 200));
    }

    #[test]
    fn stays_on_the_screen_beside_an_anchor_near_the_bottom() {
        let corner = beside(rect(100, 900, 300, 100), 350, 420, SCREEN, 8);
        assert_eq!(corner, (408, 660));
    }

    #[test]
    fn goes_below_an_anchor_as_wide_as_the_screen() {
        let corner = beside(rect(0, 100, 1920, 200), 350, 420, SCREEN, 8);
        assert_eq!(corner, (0, 308));
    }

    #[test]
    fn goes_above_a_wide_anchor_at_the_bottom() {
        let corner = beside(rect(0, 700, 1920, 380), 350, 420, SCREEN, 8);
        assert_eq!(corner, (0, 272));
    }

    #[test]
    fn covers_the_least_of_an_anchor_that_leaves_no_side_free() {
        // 200 pixels are free on the right, more than on any other side
        let corner = beside(rect(100, 100, 1620, 900), 350, 420, SCREEN, 8);
        assert_eq!(corner, (1570, 100));
    }

    #[test]
    fn goes_over_the_middle_of_an_anchor_that_fills_the_screen() {
        let corner = beside(SCREEN, 350, 420, SCREEN, 8);
        assert_eq!(corner, (785, 330));
    }

    #[test]
    fn goes_beside_a_point() {
        let corner = beside(rect(500, 500, 0, 0), 350, 420, SCREEN, 8);
        assert_eq!(corner, (508, 500));
    }

    #[test]
    fn never_covers_a_point_in_the_corner_of_the_screen() {
        let corner = beside(rect(1900, 1060, 0, 0), 350, 420, SCREEN, 8);
        assert_eq!(corner, (1542, 660));
    }

    #[test]
    fn stays_inside_bounds_that_do_not_start_at_zero() {
        let second = rect(-1920, 0, 1920, 1040);
        let corner = beside(rect(-400, 900, 300, 100), 350, 420, second, 8);
        assert_eq!(corner, (-758, 620));
    }

    #[test]
    fn starts_at_the_edge_of_bounds_smaller_than_the_window() {
        let corner = beside(rect(10, 10, 20, 20), 350, 420, rect(0, 0, 300, 300), 8);
        assert_eq!(corner, (0, 0));
    }
}
