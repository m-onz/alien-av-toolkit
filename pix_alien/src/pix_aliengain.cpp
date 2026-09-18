////////////////////////////////////////////////////////
//
// pix_aliengain — per-channel gain + bias for Gem
//
// Implementation. See pix_aliengain.h for the interface.
// Structure mirrors Gem's pix_invert.cpp / pix_posterize.cpp.
//
// SPDX-License-Identifier: GPL-2.0-or-later
//
////////////////////////////////////////////////////////

#include "pix_aliengain.h"

// Register the class with Pd, taking one (defaulted) float creation arg.
CPPEXTERN_NEW_WITH_ONE_ARG(pix_aliengain, t_floatarg, A_DEFFLOAT);

/////////////////////////////////////////////////////////
// clamp a float to a valid 8-bit pixel value
/////////////////////////////////////////////////////////
static inline unsigned char clampByte(float v)
{
  if (v <= 0.f)   return 0;
  if (v >= 255.f) return 255;
  return static_cast<unsigned char>(v + 0.5f);
}

/////////////////////////////////////////////////////////
// Constructor
/////////////////////////////////////////////////////////
pix_aliengain :: pix_aliengain(t_floatarg f) :
  m_inletGain(0), m_inletBias(0),
  m_gain((f > 0.f) ? f : 1.f), m_bias(0.f)
{
  // Two extra inlets, each routed to a named "float" method.
  m_inletGain = inlet_new(this->x_obj, &this->x_obj->ob_pd,
                          gensym("float"), gensym("gain"));
  m_inletBias = inlet_new(this->x_obj, &this->x_obj->ob_pd,
                          gensym("float"), gensym("bias"));
}

/////////////////////////////////////////////////////////
// Destructor
/////////////////////////////////////////////////////////
pix_aliengain :: ~pix_aliengain()
{
  if (m_inletGain) inlet_free(m_inletGain);
  if (m_inletBias) inlet_free(m_inletBias);
}

/////////////////////////////////////////////////////////
// message handlers
/////////////////////////////////////////////////////////
void pix_aliengain :: gainMess(float f)
{
  m_gain = f;
  setPixModified();   // force a reprocess even if the image is unchanged
}

void pix_aliengain :: biasMess(float f)
{
  m_bias = f;
  setPixModified();
}

/////////////////////////////////////////////////////////
// RGBA processing — the main path
/////////////////////////////////////////////////////////
void pix_aliengain :: processRGBAImage(imageStruct &image)
{
  const float bias = m_bias * 255.f;
  const float gain = m_gain;

  int i = image.xsize * image.ysize;
  unsigned char *base = image.data;
  while (i--) {
    base[chRed]   = clampByte(base[chRed]   * gain + bias);
    base[chGreen] = clampByte(base[chGreen] * gain + bias);
    base[chBlue]  = clampByte(base[chBlue]  * gain + bias);
    // leave chAlpha untouched
    base += 4;
  }
}

/////////////////////////////////////////////////////////
// Gray processing
/////////////////////////////////////////////////////////
void pix_aliengain :: processGrayImage(imageStruct &image)
{
  const float bias = m_bias * 255.f;
  const float gain = m_gain;

  int i = image.xsize * image.ysize;
  unsigned char *base = image.data;
  while (i--) {
    base[chGray] = clampByte(base[chGray] * gain + bias);
    base++;
  }
}

/////////////////////////////////////////////////////////
// static setup — bind the "gain" and "bias" selectors to methods
/////////////////////////////////////////////////////////
void pix_aliengain :: obj_setupCallback(t_class *classPtr)
{
  CPPEXTERN_MSG1(classPtr, "gain", gainMess, float);
  CPPEXTERN_MSG1(classPtr, "bias", biasMess, float);
}
