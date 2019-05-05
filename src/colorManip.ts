import * as Color from 'color';
import { C } from './Constants';

export class ColorManip {

  /** lightness ranges from -1 to 1.  values under 0 get darkened.  over 0: lightened */
  static adjustColor(base: string, saturation: number, lightness: number) {

    if (saturation === undefined) {
      saturation = C.defaultSaturation;
    }
    if (lightness === undefined) {
      lightness = C.defaultLightness;
    }

    // console.log("in adjustColor: base: " + base + ', sat: ' + saturation + ', lightness: ' + lightness);

    let color = Color(base);
    // if (saturation !== 1) {
    color = color.saturate(saturation);
    // }

    if (lightness >= 0) {
      color = color.lighten(lightness);
    }
    else if (lightness < 0) {
      color = color.darken(lightness * -1);
    }
    return color;
  }

  static getColorWithLuminosity = (color: Color, min: number, max: number): Color => {

    let c: Color = Color(color.hex());

    while (c.luminosity() > max) {
      c = c.darken(0.01);
    }
    while (c.luminosity() < min) {
      c = c.lighten(0.01);
    }
    return c;
  }

  static getHighContrastFromStr(colorStr: string) {
    return ColorManip.getHighContrast(Color(colorStr));
  }


  static makeSlightlyMoreExtreme(color: Color): Color {

    if (color.luminosity() > 0.375) { //a light color https://www.npmjs.com/package/color#luminosity
      return color.lighten(0.5);
    }
    else {
      return color.darken(0.5);
    }
  }

  static getHighContrast(color: Color) {
    // console.log('getHighContrast: ' + color + " " + color.hex());

    let result;

    if (color.luminosity() > 0.375) { //a light color https://www.npmjs.com/package/color#luminosity
      result = ColorManip.getVeryDark(color);
    }
    else {
      result = ColorManip.getVeryLight(color);
    }
    // Tools.showInformationMessage('getHighContrast: ' + color.hex() + ' ' + result.hex());
    // console.log('getHighContrast: ' + color.hex() + ' ' + result.hex());
    return result;
  }

  static getMaxContrastStr(color: Color) {
    return color.luminosity() > 0.375 ? '#000002' : '#ffffff';
  }

  static getDark(color: Color): Color {
    const activityBarColor_dark = ColorManip.getColorWithLuminosity(color, .02, .027);
    return activityBarColor_dark;
  };

  static getLight(color: Color): Color {
    const activityBarColor_light = ColorManip.getColorWithLuminosity(color, 0.45, 0.55);
    return activityBarColor_light;
  };

  static getVeryDark(color: Color) {
    return ColorManip.getColorWithLuminosity(color, 0, 0.01);
  }
  static getVeryLight(color: Color) {
    return ColorManip.getColorWithLuminosity(color, 0.95, 1);
  }

  static getHighContrastWith(target: Color, reference: Color) {
    // return color.luminosity() > 0.375 ? '#000002' : '#ffffff';

    if (reference.luminosity() > 0.375) { //a light color https://www.npmjs.com/package/color#luminosity
      // return ColorManip.getVeryDark(target);
      return target.darken(0.4);
    }
    else {
      // return ColorManip.getVeryLight(target);
      return target.lighten(0.4);
    }
  }

}