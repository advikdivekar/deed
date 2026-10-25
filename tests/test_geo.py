import math
import pytest
from deedreader.geo import Call, azimuth, az_to_bearing, closure, find_fixes, to_feet, arc_points
from deedreader.fmt import encode, decode
from deedreader.words import num_to_words, words_to_int, numbers_in


def L(ns, d, m, ew, dist, unit="ft", s=0):
    return Call("line", ns, d, m, s, ew, dist, unit, "")


def test_azimuth_quadrants():
    assert azimuth(L("N", 42, 15, "E", 1)) == pytest.approx(42.25)
    assert azimuth(L("S", 30, 0, "E", 1)) == pytest.approx(150)
    assert azimuth(L("S", 30, 0, "W", 1)) == pytest.approx(210)
    assert azimuth(L("N", 30, 0, "W", 1)) == pytest.approx(330)
    assert azimuth(L("S", 90, 0, "E", 1)) == pytest.approx(90)


def test_az_roundtrip():
    for az in (0, 12.5, 90, 123.4567, 180, 200.25, 270, 359.9):
        b = az_to_bearing(az)
        assert azimuth(Call("line", b[0], b[1], b[2], b[3], b[4], 1, "ft")) == pytest.approx(az, abs=1 / 3600 + 1e-9)


def test_units():
    assert to_feet(1, "chain") == 66 and to_feet(1, "pole") == 16.5 and to_feet(100, "link") == pytest.approx(66)
    assert to_feet(36, "vara") == pytest.approx(100) and to_feet(1, "m") == pytest.approx(3.28083333, rel=1e-6)


def rect(h=200.0):
    return [L("N", 0, 0, "E", 200), L("S", 90, 0, "E", 100), L("S", 0, 0, "E", h), L("N", 90, 0, "W", 100)]


def test_rectangle_exact():
    r = closure(rect())
    assert r.misclosure == pytest.approx(0, abs=1e-9) and r.closed
    assert r.area_sqft == pytest.approx(20000) and r.acres == pytest.approx(20000 / 43560)
    assert r.perimeter == pytest.approx(600)


def test_open_traverse():
    r = closure(rect(190))
    assert r.misclosure == pytest.approx(10) and r.ratio == pytest.approx(59) and not r.closed


def test_curve_area_half_disc():
    # 200 ft diameter half-disc: straight chord north 200 ft, curve returns south with chord 200 and radius 100 bulging east.
    calls = [L("N", 0, 0, "E", 200), Call("curve", "S", 0, 0, 0, "E", 200, "ft", "", 100.0, "ft", "R")]
    # traveling south, center on the right of travel is west; arc bulges east. Region is the half disc.
    r = closure(calls)
    assert r.misclosure == pytest.approx(0, abs=1e-9)
    assert r.area_sqft == pytest.approx(math.pi * 100**2 / 2, rel=1e-6)
    assert r.perimeter == pytest.approx(200 + math.pi * 100, rel=1e-6)


def test_arc_points_on_circle():
    pts = arc_points((0, 0), (0, -200), 100, "R")
    assert all(math.hypot(x - pts[0][0] * 0 - 0, y + 100) == pytest.approx(100, abs=1e-6) for x, y in pts)
    assert max(x for x, _ in pts) == pytest.approx(100, abs=1e-6)  # bulges east


def test_fixes_find_transposition_and_flip():
    base = [L("N", 41, 0, "E", 121.9), L("N", 86, 29, "E", 130.2), L("S", 13, 4, "E", 115.0), L("S", 68, 22, "W", 124.8), L("N", 64, 10, "W", 133.2)]
    assert closure(base).closed
    bad = list(base); bad[1] = Call("line", "N", 86, 29, 0, "E", 103.2, "ft", "")
    f = find_fixes(bad)
    assert f and f[0].index == 1 and f[0].call.dist == 130.2
    bad2 = list(base); bad2[2] = Call("line", "N", 13, 4, 0, "E", 115.0, "ft", "")
    assert find_fixes(bad2)[0].index == 2


def test_compact_roundtrip():
    calls = [L("N", 41, 0, "E", 121.9), Call("curve", "S", 10, 5, 30, "W", 80.25, "ft", "stone", 150.0, "ft", "L")]
    calls[0] = Call("line", "N", 41, 0, 0, "E", 121.9, "ft", "iron pin")
    pob, got, errs = decode(encode("white oak", calls))
    assert not errs and pob == "white oak" and got == calls


def test_decode_flags_garbage():
    _, calls, errs = decode("POB x\nL N 91 0 0 E 10 ft | a\nhello")
    assert len(errs) >= 2


def test_words():
    assert num_to_words(121.9) == "one hundred twenty-one and nine tenths"
    assert words_to_int("one hundred twenty-one") == 121 and words_to_int("two thousand five hundred") == 2500
    assert 121.9 in numbers_in("run one hundred twenty-one and nine tenths feet")
    assert 118.5 in numbers_in("118 1/2 feet") and 42.0 in numbers_in("forty-two degrees") and 2.0 in numbers_in("N 42° E 2.0")


def test_unit_aliases_normalize():
    _, calls, errs = decode("POB x\nL N 13 24 0 E 186.4 varas | stake\nL S 1 0 0 W 5 feet | stone\nL S 1 0 0 W 5 rods | stone")
    assert not errs and [c.unit for c in calls] == ["vara", "ft", "pole"]
