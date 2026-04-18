/*  IntelligentVisionZeroing – Universal Cold Zeroing System V3.2
 *  --------------------------------------------------------------
 *  Loads Photos/input_target.png, detects grid / laser / reticle,
 *  and outputs 3 distances (or an error message).
 */

#include <opencv2/opencv.hpp>
#include <iostream>
#include <vector>
#include <algorithm>
#include <cmath>

// ── Default Configuration ───────────────────────────────────────
static constexpr double BORE_TO_RAIL_HEIGHT = 25.4;   // mm
static constexpr double OPTIC_BASE_TO_CENTER = 38.0;  // mm
static constexpr double GRID_SPACING_MM = 10.0;       // mm

// ── Grid Detection → pixels_per_mm ─────────────────────────────
static double detectGridScale(const cv::Mat& gray) {
    cv::Mat blurred, edges;
    cv::GaussianBlur(gray, blurred, cv::Size(5, 5), 1.0);
    cv::Canny(blurred, edges, 50, 150);

    std::vector<cv::Vec2f> lines;
    cv::HoughLines(edges, lines, 1, CV_PI / 180, 120);

    std::vector<double> h_rho, v_rho;
    for (const auto& l : lines) {
        double rho   = std::abs(l[0]);
        double theta = l[1];
        if (std::abs(theta - CV_PI / 2) < CV_PI / 18)
            h_rho.push_back(rho);
        else if (theta < CV_PI / 18 || theta > CV_PI - CV_PI / 18)
            v_rho.push_back(rho);
    }

    auto medianGap = [](std::vector<double>& v) -> double {
        if (v.size() < 2) return 0.0;
        std::sort(v.begin(), v.end());
        std::vector<double> gaps;
        for (size_t i = 1; i < v.size(); ++i)
            gaps.push_back(v[i] - v[i - 1]);
        std::sort(gaps.begin(), gaps.end());
        return gaps[gaps.size() / 2];
    };

    double hg = medianGap(h_rho);
    double vg = medianGap(v_rho);
    double pixel_gap = (hg > 0 && vg > 0) ? (hg + vg) / 2.0
                     : (hg > 0)            ? hg
                     : vg;

    return (pixel_gap > 0) ? pixel_gap / GRID_SPACING_MM : 0.0;
}

// ── Colour-blob centroid (HSV) ──────────────────────────────────
static cv::Point2d findCentroid(const cv::Mat& hsv,
                                const cv::Scalar& lo,
                                const cv::Scalar& hi) {
    cv::Mat mask;
    cv::inRange(hsv, lo, hi, mask);
    cv::Mat k = cv::getStructuringElement(cv::MORPH_ELLIPSE, cv::Size(5, 5));
    cv::morphologyEx(mask, mask, cv::MORPH_OPEN, k);
    cv::morphologyEx(mask, mask, cv::MORPH_CLOSE, k);

    std::vector<std::vector<cv::Point>> contours;
    cv::findContours(mask, contours, cv::RETR_EXTERNAL, cv::CHAIN_APPROX_SIMPLE);
    if (contours.empty()) return {-1, -1};

    auto best = std::max_element(contours.begin(), contours.end(),
        [](const auto& a, const auto& b) {
            return cv::contourArea(a) < cv::contourArea(b);
        });
    cv::Moments m = cv::moments(*best);
    if (m.m00 < 1e-6) return {-1, -1};
    return {m.m10 / m.m00, m.m01 / m.m00};
}

// ── Main ────────────────────────────────────────────────────────
int main() {
    cv::Mat frame = cv::imread("Photos/input_target.png");
    if (frame.empty()) {
        std::cout << "Error: Cannot load Photos/input_target.png" << std::endl;
        return 1;
    }

    cv::Mat gray, hsv;
    cv::cvtColor(frame, gray, cv::COLOR_BGR2GRAY);
    cv::cvtColor(frame, hsv,  cv::COLOR_BGR2HSV);

    // 1. Grid
    double ppmm = detectGridScale(gray);
    if (ppmm <= 0.0) {
        std::cout << "Error: Grid not detected" << std::endl;
        return 0;
    }

    // 2. Green laser
    cv::Point2d laser = findCentroid(hsv, {35, 50, 50}, {85, 255, 255});
    if (laser.x < 0) {
        std::cout << "Error: Laser point not detected" << std::endl;
        return 0;
    }

    // 3. Red reticle
    cv::Point2d r1 = findCentroid(hsv, {0, 50, 50},   {10, 255, 255});
    cv::Point2d r2 = findCentroid(hsv, {170, 50, 50},  {180, 255, 255});
    cv::Point2d reticle;
    if (r1.x >= 0 && r2.x >= 0)
        reticle = (r1 + r2) * 0.5;
    else if (r1.x >= 0)
        reticle = r1;
    else if (r2.x >= 0)
        reticle = r2;
    else {
        std::cout << "Error: Reticle not detected" << std::endl;
        return 0;
    }

    // 4. Calculations
    double hob_mm = BORE_TO_RAIL_HEIGHT + OPTIC_BASE_TO_CENTER;
    double ideal_x = laser.x;
    double ideal_y = laser.y - (hob_mm * ppmm);

    double error_x_mm = (reticle.x - ideal_x) / ppmm;
    double error_y_mm = (ideal_y - reticle.y) / ppmm;
    double abs_y_mm   = std::abs(laser.y - reticle.y) / ppmm;

    // 5. Output
    std::cout << "Error X: " << error_x_mm << " mm" << std::endl;
    std::cout << "Error Y: " << error_y_mm << " mm" << std::endl;
    std::cout << "Absolute Y Distance: " << abs_y_mm << " mm" << std::endl;

    return 0;
}
