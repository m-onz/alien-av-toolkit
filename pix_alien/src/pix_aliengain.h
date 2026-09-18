/* ------------------------------------------------------------------
 * pix_aliengain — a minimal custom Gem pix_ effect
 *
 * Part of the alien-av-toolkit. Modeled on Gem's own pix_invert
 * (simplest single-input effect) and pix_posterize (parameter inlets).
 *
 * Per-channel brightness/contrast:  out = clamp(in * gain + bias)
 *
 * Inlets:
 *   1 (default) — the image, plus creation arg = initial gain
 *   2 "gain"    — float, multiplies RGB   (0 .. ~4, default 1)
 *   3 "bias"    — float, adds to RGB      (-1 .. 1, scaled to 0..255)
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 * ------------------------------------------------------------------ */

#ifndef _INCLUDE__ALIEN_PIX_ALIENGAIN_H_
#define _INCLUDE__ALIEN_PIX_ALIENGAIN_H_

#include "Base/GemPixObj.h"

/*-----------------------------------------------------------------
CLASS
    pix_aliengain

KEYWORDS
    pix

DESCRIPTION
    per-channel gain + bias (brightness / contrast)
-----------------------------------------------------------------*/
class GEM_EXTERN pix_aliengain : public GemPixObj
{
  CPPEXTERN_HEADER(pix_aliengain, GemPixObj);

public:

  //////////
  // Constructor. Creation arg sets the initial gain.
  pix_aliengain(t_floatarg f);

protected:

  //////////
  // Destructor
  virtual ~pix_aliengain();

  //////////
  // The workers. We provide RGBA and Gray; Gem will convert for us.
  virtual void    processRGBAImage(imageStruct &image);
  virtual void    processGrayImage(imageStruct &image);

  //////////
  // Message handlers, bound in obj_setupCallback().
  void            gainMess(float f);
  void            biasMess(float f);

  //////////
  // Extra inlets created in the constructor.
  t_inlet        *m_inletGain;
  t_inlet        *m_inletBias;

  //////////
  // State (kept as floats; applied per pixel).
  float           m_gain;
  float           m_bias;   // -1..1, applied as bias*255
};

#endif  // for header file
