import * as Color from 'color';
import * as tinygradient from 'tinygradient';
import * as vscode from 'vscode';
import { C } from './Constants';
import { Tools } from './tools';

export class A {
  static doAnimate = false;
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function saveGradientInputColors(colors: string) {

  let recentGradientColors = await Tools.getSetting(C.RecentGradientColors);

  if (recentGradientColors) {
    if (!(colors in recentGradientColors)) {
      recentGradientColors = [colors, ...recentGradientColors];
    }
  }
  else {
    recentGradientColors = [colors];
  }
  await Tools.setGlobalSetting(C.RecentGradientColors, recentGradientColors);
}


export function generateGradient(gradientInput: string): string[] {

  // const STEPS_PER_TRANSITION = 500;
  const STEPS_PER_TRANSITION = Tools.getSetting(C.animationStepsPerTransition);

  //TODO - 500 steps per color pair?

  const gradientInputArray = gradientInput.split(' ');

  const first = gradientInputArray[0];
  const last = gradientInputArray[gradientInputArray.length - 1];

  if (first !== last) {
    gradientInputArray.push(first); //so each transition is smooth
  }

  const numTransitions = gradientInputArray.length - 1;
  const numSteps = numTransitions * STEPS_PER_TRANSITION;

  const gradient = tinygradient(gradientInputArray);

  const gradientOutputArray = gradient.rgb(numSteps).map((x: { toHexString: () => void; }) => x.toHexString());

  return gradientOutputArray as any as string[];
}


export async function animate(gradientInputStr: string) {
  A.doAnimate = true;
  const MILLISECONDS_PER_STEP = Tools.getSetting(C.animationMillisecondsPerStep);

  const gradientInputArray = (gradientInputStr as string).split(' ');

  for (let i = 0; i < gradientInputArray.length; i++) {
    const colorSt = gradientInputArray[i];

    if (!Tools.isValidColor(colorSt)) {
      vscode.window.showErrorMessage('"' + colorSt + '" is not a valid color.');
      return;
    }

  }

  const gradient = generateGradient(gradientInputStr as string);

  while (A.doAnimate) {
    for (let i = 0; i < gradient.length; i++) {
      await sleep(MILLISECONDS_PER_STEP);
      let s = Tools.getInternalSettingsObject();
      let c = Tools.getExtensionSettings();


      if (A.doAnimate && s[C.animationDoAnimate] && s[C.animationGradientInputStr] === gradientInputStr) {
        let cc = Tools.getColorCustomizations();

        let gradientColor = Color(gradient[i]);

        if (c[C.ModifyTitleBar]) {
          let color = Tools.slightlyLighter(gradientColor);
          cc[C.titleBar_activeBackground] = color.hex();

          // cc[C.titleBar_activeBackground] = Color(gradient[i]).lighten(0.1).hex();

          cc[C.titleBar_inactiveBackground] = gradient[i];
        }
        if (c[C.ModifyActivityBar]) {
          cc[C.activityBar_background] = gradient[i];
        }
        if (c[C.ModifyStatusBar]) {
          let color = Tools.slightlyDarker(gradientColor);

          cc[C.statusBar_background] = color.hex();
        }
        await Tools.setColorCustomizations(cc);
      }
      else {
        break;
      }
    }
  }

}


export async function animateHandler() {

  //Options:
  const ENTER_COLORS = 'Enter gradient colors';
  const RECENT = 'Recent';
  const STOP = 'Stop animation';

  let selection = await vscode.window.showQuickPick([ENTER_COLORS, RECENT, STOP], { placeHolder: 'Animation menu' }) as string;
  if (selection === undefined) {
    return;
  }

  /** list of color names separated by space, used to generate actual gradient */
  let gradientInputStr;

  switch (selection) {
    case ENTER_COLORS:
      const options: vscode.InputBoxOptions = {
        placeHolder: '(eg "peachpuff #ff00ff BlanchedAlmond teal")',
        prompt: 'Enter up to 5 colors separated by spaces'
      };
      gradientInputStr = await vscode.window.showInputBox(options);
      if (gradientInputStr === undefined) {
        return;
      }
      gradientInputStr = Tools.trim(gradientInputStr);

      await saveGradientInputColors(gradientInputStr);
      A.doAnimate = true;
      break;

    case RECENT:
      gradientInputStr = await vscode.window.showQuickPick(Tools.getSetting(C.RecentGradientColors) || ['(no recent gradients)'], { placeHolder: 'Recent gradient colors:' }) as string;
      if (gradientInputStr === undefined) {
        return;
      }
      if (A.doAnimate) {

        A.doAnimate = false;
        await Tools.setInternalSettings({
          [C.animationDoAnimate]: false,
          [C.animationGradientInputStr]: undefined,
          [C.portfolioAndColor]: undefined,
          [C.useAutomatic]: undefined
        });
      }
      A.doAnimate = true;
      break;

    case STOP:
      A.doAnimate = false;
      break;
  }

  if (gradientInputStr === '(no recent gradients)') {
    return;
  }
  if (A.doAnimate) {
    await Tools.setInternalSettings({
      [C.animationDoAnimate]: true,
      [C.animationGradientInputStr]: gradientInputStr,
      [C.portfolioAndColor]: undefined,
      [C.useAutomatic]: undefined
    });
    await animate(gradientInputStr as string);
  }
  else {
    await Tools.setInternalSettings({
      [C.animationDoAnimate]: false,
      [C.animationGradientInputStr]: '' //why not undefined?
    });
  }
}

