
export class C {


  //user-level (global) settings only
  static RecentGradientColors = 'RecentGradientColors';
  static myGlobalData = 'globalData';   //everything about specific workspaces. 
  static AutomaticColorsPortfolio = 'AutomaticColorsPortfolio'; //string
  static overwriteAllWorkspaceColorsWithAutomaticPortfolio = 'overwriteAllWorkspaceColorsWithAutomaticPortfolio';


  //workspace settings
  static internalSettings = 'internalSettings';
  // static DeleteLocalSettingsOnClose = 'DeleteLocalSettingsOnClose';  //removed.  add back in if there's interest for this
  static animationMillisecondsPerStep = 'animationMillisecondsPerStep';
  static animationStepsPerTransition = 'animationStepsPerTransition';
  static ModifyActivityBar = 'ModifyActivityBar';
  static ModifyTitleBar = 'ModifyTitleBar';
  static ModifyStatusBar = 'ModifyStatusBar';

  // these things get loaded in loadSettings and ... other stuff
  static extensionSettings = [
    C.internalSettings,
    // C.DeleteLocalSettingsOnClose,  //removed.  add back in if there's interest for this
    C.animationMillisecondsPerStep,
    C.animationStepsPerTransition,
    C.ModifyActivityBar, 
    C.ModifyTitleBar,
    C.ModifyStatusBar,
    C.AutomaticColorsPortfolio,
    C.overwriteAllWorkspaceColorsWithAutomaticPortfolio
  ];


  //internal -- members of C.internalSettings
  static BaseColor = 'BaseColor';
  static BackgroundSaturation = 'BackgroundSaturation';
  static BackgroundLightness = 'BackgroundLightness';
  static UseCustomForegroundColor = 'UseCustomForegroundColor';
  static ForegroundBaseColor = 'ForegroundBaseColor';
  static ForegroundSaturation = 'ForegroundSaturation';
  static ForegroundLightness = 'ForegroundLightness';
  static theme = 'theme';
  static animationGradientInputStr = 'animationGradientColors';
  static animationDoAnimate = 'animationDoAnimate';
  static customThemeMap = 'customThemeMap';
  static portfolioAndColor = 'portfolioAndColor'; //object 
  static useAutomatic = 'useAutomatic'; //true if workspace should use automatic colors.  false if workspace uses hand-picked colors


  //portfolioAndColor members
  static coloration = 'coloration';
  static portfolio = 'portfolio';

  //spans different objects (some in intenral settings, some in main config)
  static colorationTriggers = [
    C.BaseColor,
    C.BackgroundSaturation,
    C.BackgroundLightness,
    C.UseCustomForegroundColor,
    C.ForegroundBaseColor,
    C.ForegroundSaturation,
    C.ForegroundLightness,
    // C.theme,
    // C.animationGradientInputStr,
    // C.animationDoAnimate,
    C.customThemeMap,




    C.ModifyActivityBar,
    C.ModifyTitleBar,
    C.ModifyStatusBar
  ];


  //customThemeMap settings:
  static customThemeItemName = 'customThemeItemName';
  static customThemeBaseColor = 'customThemeBaseColor';
  static customThemeSaturation = 'customThemeSaturation';
  static customThemeLightness = 'customThemeLightness';



  //myGlobalData members:

  static savedConfigurations = 'savedConfigurations'; // @deprecated//map from saved config name to internalSettings object 
  static portfolios = 'portolios'; //map from saved config name to internalSettings object 


  static CURR_SET = 'Current setting: ';
  static CURR_SET2 = '(Current Setting)';


  static colorCustomizations = 'colorCustomizations';

  static titleBar_activeBackground = 'titleBar.activeBackground';
  static titleBar_activeForeground = 'titleBar.activeForeground';
  static titleBar_inactiveBackground = 'titleBar.inactiveBackground';
  static titleBar_inactiveForeground = 'titleBar.inactiveForeground';

  // //for testing -- cos debugger mode takes away the title bar color D:
  // static titleBar_activeBackground = 'sideBar.background';
  // static titleBar_activeForeground = 'sideBar.foreground';
  // static titleBar_inactiveBackground = 'sideBarSectionHeader.background'  ;
  // static titleBar_inactiveForeground = 'sideBarSectionHeader.foreground'  ;

  static activityBar_background = 'activityBar.background';
  static activityBar_foreground = 'activityBar.foreground';

  static statusBar_background = 'statusBar.background';
  static statusBar_foreground = 'statusBar.foreground';

  static auto: string = 'Automatic';
  static default: string = 'Default Color';

  static defaultSaturation = 1;
  static defaultLightness = 0;

  static ENTER_COLOR = 'Enter color';
  static SELECT_COLOR = 'Select Color';
  static SELECT_SAT = 'Select saturation';
  static SELECT_LIGHTNESS = 'Select lightness';
  static REMOVE_COLOR = 'Restore default color';
  static TITLE_BAR = 'Title Bar (top)';
  static ACTIVITY_BAR = 'Activity Bar (left)';
  static STATUS_BAR = 'Status Bar (bottom)';
  static REMOVE_ALL_CUST_THEME_MODS = 'Remove all custom theme modifications';
  static Automatic = 'Automatic';

  static projectorEmoji = '📽';
  static paletteEmoji = '🎨';
}